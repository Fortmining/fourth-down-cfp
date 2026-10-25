import { colleyReference } from "../app/lib/playoff/colley-reference.ts";
// Local shadow runner only. No Redis, QStash, production mutations or push calls.
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  standingsTeams,
  gameFromEspn,
  editionsFromEspn,
} from "../app/lib/playoff/espn.ts";
import { ShadowArchive } from "../app/lib/playoff/archive.ts";
import { currentRecords, mergeLedger } from "../app/lib/playoff/ledger.ts";
import {
  candidates,
  runShadow,
  compareSnapshots,
  hash,
} from "../app/lib/playoff/engine.ts";
const directory = process.env.SHADOW_OUTPUT;
if (!directory) throw Error("Set SHADOW_OUTPUT to a private output directory");
fs.mkdirSync(directory, { recursive: true });
const archive = new ShadowArchive(
  path.join(directory, "archive-v2-resume-shadow-v1.1.0"),
);
const BASE =
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football/";
let requests = 0;
const timings = [];
const capturesFile = path.join(directory, "source-captures.json");
const captures =
  process.env.SHADOW_OFFLINE === "1" && fs.existsSync(capturesFile)
    ? JSON.parse(fs.readFileSync(capturesFile))
    : {};
async function get(url, name) {
  const cached = path.join(directory, name + ".json");
  if (process.env.SHADOW_OFFLINE === "1") {
    if (!fs.existsSync(cached)) throw Error("Missing offline input " + name);
    captures[name] ??= {
      observedAt: fs.statSync(cached).mtime.toISOString(),
      httpDate: null,
      timestampEvidence: "original local capture file-write time",
    };
    return JSON.parse(fs.readFileSync(cached));
  }
  requests++;
  const start = performance.now(),
    r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  if (!r.ok) throw Error("Source HTTP " + r.status);
  const d = await r.json();
  fs.writeFileSync(cached, JSON.stringify(d, null, 2));
  captures[name] = {
    observedAt: new Date().toISOString(),
    httpDate: r.headers.get("date"),
    age: r.headers.get("age"),
    timestampEvidence: "source response captured locally",
  };
  timings.push({ name, ms: performance.now() - start, ...captures[name] });
  return d;
}
const scoreboard = await get(
    BASE + "scoreboard?groups=80&limit=150",
    "scoreboard",
  ),
  season = scoreboard.season.year;
const standings = await get(
    `https://site.api.espn.com/apis/v2/sports/football/college-football/standings?season=${season}`,
    "standings",
  ),
  rankings = await get(BASE + "rankings", "rankings"),
  teams = standingsTeams(standings);
if (standings.season?.year !== season || teams.length < 100)
  throw Error("Incomplete or invalid FBS membership source");
const periods = (scoreboard.leagues?.[0]?.calendar || [])
  .filter((p) => Number(p.value) === 2)
  .flatMap((p) =>
    p.entries.map((e) => ({
      type: Number(p.value),
      week: Number(e.value),
      start: e.startDate,
    })),
  )
  .filter((p) => p.week > 0 && p.week < 999);
const pending = new Map();
function observe(e, observedAt, source) {
  const g = gameFromEspn(e, season, observedAt, source, teams);
  if (g) return g;
  const ids = (e.competitions?.[0]?.competitors || []).map((t) =>
    String(t.team?.id),
  );
  const state =
    e.status?.type?.state || e.competitions?.[0]?.status?.type?.state;
  if (
    state === "pre" &&
    /^\d+$/.test(String(e.id)) &&
    Number.isFinite(Date.parse(e.date))
  ) {
    pending.set(String(e.id), {
      id: String(e.id),
      name: e.name || "Unassigned game",
      date: e.date,
      knownTeamIds: ids.filter((id) => /^[1-9]\d{0,11}$/.test(id)),
      observedAt,
      source,
    });
  } else issues.push("Malformed event " + e.id);
  return null;
}
const seen = new Set(),
  issues = [];
let games = [];
for (let i = 0; i < periods.length; i += 4)
  await Promise.all(
    periods.slice(i, i + 4).map(async (p) => {
      try {
        const raw = await get(
          BASE +
            `scoreboard?groups=80&limit=150&year=${season}&seasontype=${p.type}&week=${p.week}`,
          `week-${p.week}`,
        );
        if (
          raw.season?.year !== season ||
          raw.week?.number !== p.week ||
          !Array.isArray(raw.events)
        )
          throw Error("Invalid season/snapshot");
        if (raw.events.length >= 150)
          issues.push("Possible truncated week " + p.week);
        seen.add(p.week);
        for (const e of raw.events) {
          const g = observe(
            e,
            captures[`week-${p.week}`].observedAt,
            `ESPN week ${p.week}`,
          );
          if (g) games.push(g);
        }
      } catch (e) {
        issues.push("Week " + p.week + " unavailable: " + e.message);
      }
    }),
  );
const observedAt = new Date(
  Math.max(...Object.values(captures).map((c) => Date.parse(c.observedAt))),
).toISOString();
fs.writeFileSync(capturesFile, JSON.stringify(captures, null, 2));
games = mergeLedger([], games);
games = mergeLedger(
  games,
  (scoreboard.events || [])
    .map((e) =>
      observe(e, captures.scoreboard.observedAt, "ESPN current scoreboard"),
    )
    .filter(Boolean),
);
const pendingGames = [...pending.values()]
  .filter((p) => !games.some((g) => g.id === p.id))
  .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const input = {
  pendingGames,
  season,
  observedAt,
  teams,
  games,
  editions: editionsFromEspn(rankings, season, observedAt),
  coverage: {
    complete: issues.length === 0 && seen.size === periods.length,
    futureComplete: pendingGames.length === 0,
    issues,
  },
  rulesVersion: "cfp-2026-unverified-conference-adapters",
};
const records = currentRecords(input),
  conflicts = teams
    .filter((t) => records[t.id].status === "conflict")
    .map((t) => ({
      id: t.id,
      name: t.name,
      reported: t.reportedRecord,
      ledger: records[t.id].overall,
      reportedConference: t.reportedConferenceRecord,
      ledgerConference: records[t.id].conference,
    }));
if (conflicts.length) {
  input.coverage.complete = false;
  input.coverage.issues.push(
    "Provider record totals do not reconcile for " +
      conflicts.length +
      " teams",
  );
}
fs.writeFileSync(
  path.join(directory, "inputs.json"),
  JSON.stringify(input, null, 2),
);
const save = (s) => archive.save(s);
const models = [];
for (const weights of candidates) {
  const start = performance.now(),
    snapshot = runShadow(input, weights);
  const file = save(snapshot),
    provisional = runShadow(input, weights, true, snapshot.id);
  save(provisional);
  models.push({ weights, ms: performance.now() - start, snapshot, file });
}
const baseline = models[0].snapshot,
  comparisons = models.map((m) => ({
    id: m.weights.id,
    top12ResumeOrder: m.snapshot.rows
      .slice(0, 12)
      .map((r) => ({ id: r.id, name: r.name, score: r.score })),
    differentTop12: m.snapshot.rows
      .slice(0, 12)
      .filter((r) => !baseline.rows.slice(0, 12).some((b) => b.id === r.id))
      .map((r) => r.name),
    maxPositionDifference: Math.max(
      ...m.snapshot.rows.map((r) =>
        Math.abs(
          r.position - baseline.rows.find((b) => b.id === r.id).position,
        ),
      ),
    ),
    elapsedMs: m.ms,
    bytes: fs.statSync(m.file).size,
    issues: m.snapshot.issues,
  }));
// Reconstructed result insertion, not historical as-of observations or real finish order.
const replayStart = process.env.SHADOW_REPLAY_START || "2026-10-24T04:00:00Z",
  replayEnd = process.env.SHADOW_REPLAY_END || "2026-10-25T04:00:00Z";
let replayInput = {
  ...input,
  teams: teams.map((t) => ({
    ...t,
    reportedRecord: undefined,
    reportedConferenceRecord: undefined,
  })),
  games: games.filter((g) => Date.parse(g.date) < Date.parse(replayStart)),
  coverage: {
    complete: false,
    issues: [
      "Reconstructed replay, revised current source inputs; no historical as-of guarantee",
    ],
  },
};
let prior = runShadow(replayInput);
save(prior);
const replays = [];
for (const game of games
  .filter(
    (g) =>
      Date.parse(g.date) >= Date.parse(replayStart) &&
      Date.parse(g.date) < Date.parse(replayEnd) &&
      g.state === "post",
  )
  .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
  const nextInput = {
      ...replayInput,
      games: mergeLedger(replayInput.games, [game]),
    },
    next = runShadow(nextInput);
  save(next);
  const changes = compareSnapshots(prior, next);
  replays.push({
    gameId: game.id,
    teams: game.teams,
    changes,
    unrelatedTeamsChanged: changes.filter((x) => !game.teams.includes(x.id))
      .length,
    from: prior.id,
    to: next.id,
  });
  prior = next;
  replayInput = nextInput;
}
const archivedIds = fs
  .readdirSync(path.join(archive.directory, "snapshots"))
  .map((f) => f.replace(/\.json$/, ""));
for (const id of archivedIds)
  if (archive.restore(id).id !== id) throw Error("Archive replay failed " + id);
const reference = colleyReference(input);
const referenceComparison = {
  ...reference,
  differentTop12: reference.rows
    .slice(0, 12)
    .filter((r) => !baseline.rows.slice(0, 12).some((b) => b.id === r.id))
    .map((r) => r.name),
  maxPositionDifference: Math.max(
    ...reference.rows.map((r) =>
      Math.abs(r.position - baseline.rows.find((b) => b.id === r.id).position),
    ),
  ),
};
const report = {
  referenceComparison,
  shadow: true,
  offlineReplay: process.env.SHADOW_OFFLINE === "1",
  sourceCaptures: captures,
  season,
  observedAt,
  requests,
  redisCommands: 0,
  qstashDeliveries: 0,
  productionMutations: 0,
  teams: teams.length,
  games: games.length,
  pendingGames: pendingGames.length,
  scheduleEntries: games.length + pendingGames.length,
  finals: games.filter((g) => g.state === "post").length,
  coverage: input.coverage,
  reconciliationConflicts: conflicts,
  comparisons,
  replay: {
    label:
      "Reconstructed final-result insertion in scheduled-start order, not original completion history",
    events: replays,
  },
  snapshots: archive.count,
  snapshotBytes: archive.bytes,
  replayVerified: archive.restore(baseline.id).id === baseline.id,
  allSnapshotsReplayed: archivedIds.length,
  inputHash: hash(input),
  sourceTimings: timings,
};
fs.writeFileSync(
  path.join(directory, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      ...report,
      comparisons: comparisons.map(({ issues, ...m }) => ({
        ...m,
        issues: issues.length,
      })),
      replay: { events: replays.length, label: report.replay.label },
      sourceTimings: undefined,
    },
    null,
    2,
  ),
);
