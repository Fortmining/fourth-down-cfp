// Manual, private shadow ingestion. Never imported by an app route or scheduler.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { ShadowSession } from "../app/lib/playoff/session.ts";
import {
  gameFromEspn,
  standingsTeams,
  editionsFromEspn,
} from "../app/lib/playoff/espn.ts";
import { mergeLedger, currentRecords } from "../app/lib/playoff/ledger.ts";
import { hash } from "../app/lib/playoff/engine.ts";
import { compareAsOf } from "../app/lib/playoff/temporal.ts";
import { resolveConference } from "../app/lib/playoff/conference.ts";
import { applyEligibility } from "../app/lib/playoff/eligibility.ts";
import { eligibilityEvidence2026 } from "../app/data/playoff-eligibility-2026.ts";

const root = process.env.SHADOW_SESSION,
  seedFile = process.env.SHADOW_SEED;
if (!root || !seedFile)
  throw Error(
    "Set SHADOW_SESSION and SHADOW_SEED to private paths outside the repository",
  );
const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
if (path.resolve(root).startsWith(repo + path.sep))
  throw Error("Private archive must be outside repository");
const seed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
const raw = [],
  sourceHashes = { seed: hash(seed) };
let sourceRequests = 0;
async function get(url, name) {
  const r = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  sourceRequests++;
  if (!r.ok) throw Error("Source HTTP " + r.status + " for " + name);
  const body = await r.json(),
    receivedAt = new Date().toISOString();
  const id = hash(body);
  sourceHashes[name] = id;
  raw.push({
    name,
    id,
    body,
    receivedAt,
    httpDate: r.headers.get("date"),
    age: r.headers.get("age"),
  });
  return { body, receivedAt };
}
const base =
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football/";
const [board, poll, standings] = await Promise.all([
  get(base + "scoreboard?groups=80&limit=150", "scoreboard"),
  get(base + "rankings", "rankings"),
  get(
    "https://site.api.espn.com/apis/v2/sports/football/college-football/standings?season=" +
      seed.season,
    "standings",
  ),
]);
if (
  board.body.season?.year !== seed.season ||
  standings.body.season?.year !== seed.season ||
  !Array.isArray(board.body.events) ||
  board.body.events.length >= 150
)
  throw Error("Invalid/truncated source season");
const eligibility = applyEligibility(
  standingsTeams(standings.body),
  eligibilityEvidence2026,
  seed.season,
  new Date().toISOString(),
);
const teams = eligibility.teams;
if (
  teams.length !== seed.teams.length ||
  teams.some(
    (t) =>
      !seed.teams.some((s) => s.id === t.id && s.conference === t.conference),
  )
)
  throw Error("Membership changed; full bootstrap required");
const pending = new Map((seed.pendingGames || []).map((g) => [g.id, g])),
  sourceIssues = [];
const incoming = board.body.events.flatMap((e) => {
  const g = gameFromEspn(
    e,
    seed.season,
    board.receivedAt,
    "ESPN manual shadow scoreboard",
    teams,
  );
  if (g) return [g];
  if (
    e.status?.type?.state === "pre" &&
    /^\d+$/.test(String(e.id)) &&
    Number.isFinite(Date.parse(e.date))
  ) {
    pending.set(String(e.id), {
      id: String(e.id),
      name: e.name || "Unassigned game",
      date: e.date,
      knownTeamIds: (e.competitions?.[0]?.competitors || [])
        .map((t) => String(t.team?.id))
        .filter((id) => /^[1-9]\d{0,11}$/.test(id)),
      observedAt: board.receivedAt,
      source: "ESPN manual shadow scoreboard",
    });
  } else sourceIssues.push("Malformed scoreboard event " + String(e.id));
  return [];
});
for (const g of incoming) {
  const old = seed.games.find((x) => x.id === g.id);
  if (old?.completed && g.state !== "post")
    sourceIssues.push(
      "Terminal-state regression retained previous verified result: " + g.id,
    );
}
const games = mergeLedger(seed.games, incoming),
  receivedAt = new Date().toISOString();
const editions = editionsFromEspn(poll.body, seed.season, receivedAt);
if (!editions.length)
  throw Error("Published ranking source unavailable; no new baseline");
// Retain previous official editions as history; latest valid publication is selected by engine.
const prior = new Map(seed.editions.map((e) => [e.id + ":" + e.date, e]));
for (const e of editions) prior.set(e.id + ":" + e.date, e);
const input = {
  ...seed,
  teams,
  games,
  editions: [...prior.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  ),
  observedAt: receivedAt,
  pendingGames: [...pending.values()].filter(
    (p) => !games.some((g) => g.id === p.id),
  ),
  coverage: {
    ...seed.coverage,
    complete: seed.coverage.complete && !sourceIssues.length,
    issues: [...seed.coverage.issues, ...sourceIssues],
  },
};
const records = currentRecords(input),
  conflicts = teams
    .filter((t) => records[t.id].status === "conflict")
    .map((t) => t.id);
if (conflicts.length) {
  input.coverage.complete = false;
  input.coverage.issues.push(
    "Record reconciliation conflicts: " + conflicts.join(","),
  );
}
const vintage = {
  schema: 1,
  receivedAt,
  provenance: "captured-live",
  sourceHashes,
  inputHash: hash(input),
  inputs: input,
};
const session = new ShadowSession(root),
  beforeCpu = process.cpuUsage(),
  beforeTime = performance.now();
const artifacts = raw.map((r) => ({
  ...r,
  compressed: gzipSync(JSON.stringify(r.body)),
}));
const reserve =
  Buffer.byteLength(JSON.stringify(input)) +
  artifacts.reduce((n, r) => n + r.compressed.length, 0) +
  1024 * 1024;
const result = session.ingest(vintage, {
    reserveBytes: reserve,
    compareAlternatives: process.env.SHADOW_COMPARE_ALTERNATIVES === "1",
  }),
  cpu = process.cpuUsage(beforeCpu);
if (result.changed) {
  const folder = path.join(root, "sources");
  fs.mkdirSync(folder, { recursive: true });
  for (const r of artifacts) {
    const p = path.join(folder, r.id + ".json.gz");
    if (!fs.existsSync(p)) fs.writeFileSync(p, r.compressed, { flag: "wx" });
  }
}
// Current head is replaceable; historical receipts/snapshots remain immutable.
fs.writeFileSync(path.join(root, "latest-inputs.json"), JSON.stringify(input));
const receipts = session.receipts();
const report = {
  ...result,
  sourceRequests,
  sourceFetch: raw.map(({ body, ...m }) => {
    void body;
    return m;
  }),
  recordConflicts: conflicts,
  localCpuMs: (cpu.user + cpu.system) / 1000,
  localWallMs: performance.now() - beforeTime,
  eligibility: {
    verified: teams.filter((t) => t.eligible !== null).map((t) => t.id),
    unresolved: eligibility.unresolved,
    evidence: eligibilityEvidence2026,
    issues: eligibility.issues,
  },
  genuineAsOf: compareAsOf(receipts, [
    "2026-10-24T19:30:00Z",
    ...receipts.map((v) => v.receivedAt),
  ]),
  conferences: [
    ["1", "acc-2026"],
    ["4", "big12-current"],
    ["8", "sec-current"],
    ["5", "bigten-2024-carry-forward"],
  ].map(([id, policy]) =>
    resolveConference(input, id, policy, { regularSeasonComplete: false }),
  ),
  predictiveValidation: false,
  limitations: [
    "No contemporaneous pre-game full-season vintage exists in this session",
    "Functional reconstructions are excluded from as-of evaluation",
    "No public or production scheduler integration",
  ],
};
fs.writeFileSync(
  path.join(root, "latest-report.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      changed: result.changed,
      snapshots: result.snapshots,
      sourceRequests,
      recordConflicts: conflicts,
      receivedAt,
      redisCommands: 0,
      qstashDeliveries: 0,
      localCpuMs: report.localCpuMs,
      receiptCount: receipts.length,
      olderBacktest: report.genuineAsOf[0],
    },
    null,
    2,
  ),
);
