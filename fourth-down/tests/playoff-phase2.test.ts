import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hash } from "../app/lib/playoff/engine.ts";
import { ShadowSession } from "../app/lib/playoff/session.ts";
import {
  validateVintage,
  selectVintage,
  compareAsOf,
  type Vintage,
} from "../app/lib/playoff/temporal.ts";
import { scheduleAudit, isPac12FlexGame } from "../app/lib/playoff/schedule.ts";
import { resolveConference } from "../app/lib/playoff/conference.ts";
import { applyEligibility } from "../app/lib/playoff/eligibility.ts";
import { assessOperations } from "../app/lib/playoff/operations.ts";
import { gameFromEspn } from "../app/lib/playoff/espn.ts";
import {
  verifyGitVintage,
  historicalComparison,
} from "../app/lib/playoff/historical.ts";
import { createHash } from "node:crypto";
import { mergeLedger } from "../app/lib/playoff/ledger.ts";
import type { Inputs, GameRevision } from "../app/lib/playoff/types.ts";
const at = "2026-10-25T17:00:00Z";
function game(
  id: string,
  a: string,
  b: string,
  winner: string,
  state: "pre" | "in" | "post" = "post",
): GameRevision {
  return {
    id,
    season: 2026,
    date: "2026-10-24T20:00:00Z",
    state,
    completed: state === "post",
    teams: [a, b],
    winner: state === "post" ? winner : null,
    scores: winner === a ? [24, 17] : [17, 24],
    conferenceGame: true,
    period: 4,
    clock: 240,
    observedAt: at,
    source: "synthetic fixture",
  };
}
function input(conf = "8"): Inputs {
  return {
    season: 2026,
    observedAt: at,
    teams: Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      name: "Team " + (i + 1),
      conference: conf,
      eligible: true,
    })),
    games: [
      game("10", "1", "2", "1"),
      game("11", "1", "3", "1"),
      game("12", "2", "3", "2"),
      game("13", "3", "4", "3"),
    ],
    editions: [
      {
        id: "ap",
        season: 2026,
        date: "2026-10-18T07:00:00Z",
        ranks: Array.from({ length: 25 }, (_, i) => ({
          id: String(i + 1),
          rank: i + 1,
          previous: i + 1,
          record: "0-0",
        })),
      },
    ],
    coverage: { complete: true, issues: [] },
    rulesVersion: "cfp-2026-unverified-conference-adapters",
  };
}
function vintage(i = input(), receivedAt = at): Vintage {
  return {
    schema: 1,
    receivedAt,
    provenance: "captured-live",
    sourceHashes: { fixture: hash("fixture") },
    inputHash: hash(i),
    inputs: i,
  };
}

test("as-of guard rejects later capture even when game and poll dates are earlier", () => {
  const v = vintage();
  assert.equal(validateVintage(v, "2026-10-24T23:00Z").valid, false);
  assert.equal(selectVintage([v], "2026-10-24T23:00Z"), null);
  assert.equal(
    compareAsOf([v], ["2026-10-24T23:00Z"])[0].status,
    "unavailable",
  );
});
test("as-of guard rejects revised observations, future polls, wrong seasons and reconstruction labels", () => {
  for (const mutate of [
    (v: Vintage) => {
      v.inputs.games[0].observedAt = "2026-10-26T00:00Z";
    },
    (v: Vintage) => {
      v.inputs.editions[0].date = "2026-10-26T00:00Z";
    },
    (v: Vintage) => {
      v.inputs.games[0].season = 2025;
    },
    (v: Vintage) => {
      v.provenance = "reconstructed";
    },
    (v: Vintage) => {
      v.provenance = "legacy-capture-import";
    },
  ]) {
    const v = vintage();
    mutate(v);
    v.inputHash = hash(v.inputs);
    assert.equal(validateVintage(v, at).valid, false);
  }
  assert.equal(validateVintage(vintage(), at).valid, true);
});
test("as-of selection uses only then-available editions and does not mutate earlier vintage", () => {
  const old = vintage(),
    later = structuredClone(old);
  later.receivedAt = later.inputs.observedAt = "2026-10-25T19:00:00Z";
  later.inputs.editions.push({
    ...later.inputs.editions[0],
    date: "2026-10-25T18:00:00Z",
  });
  later.inputHash = hash(later.inputs);
  assert.equal(selectVintage([later, old], at)?.inputHash, old.inputHash);
  assert.equal(old.inputs.editions.length, 1);
  assert.equal(compareAsOf([old], [at])[0].models.length, 7);
});
test("pending flex and title slots are classified without inventing participants", () => {
  const i = input();
  i.teams.push({
    id: "36",
    name: "Colorado State",
    conference: "9",
    eligible: null,
  });
  i.pendingGames = [
    {
      id: "401860926",
      name: "TBD at CSU",
      date: "2026-11-28T05:00Z",
      knownTeamIds: ["36"],
      observedAt: at,
      source: "ESPN fixture",
    },
    {
      id: "401858318",
      name: "TBD at TBD",
      date: "2026-12-05T17:00Z",
      knownTeamIds: [],
      observedAt: at,
      source: "ESPN ACC championship note",
    },
  ];
  const s = scheduleAudit(i);
  assert.equal(s.unclassified, 0);
  assert.equal(s.pending[0].kind, "flex-slot");
  assert.equal(s.pending[1].kind, "championship-slot");
  assert.equal(
    s.teamCoverage.find((t) => t.id === "1")!.regularOpponentsComplete,
    true,
  );
  assert.equal(
    s.teamCoverage.find((t) => t.id === "36")!.regularOpponentsComplete,
    false,
  );
  assert.equal(s.allOpponentsAssigned, false);
  i.pendingGames.push({ ...i.pendingGames[0], id: "999", knownTeamIds: [] });
  assert.equal(scheduleAudit(i).regularSeasonComplete, false);
});
test("historical committed files reject altered bytes and future dated outcomes/polls", () => {
  const i = input();
  i.season = 2025;
  i.rulesVersion = "historical-resume-no-qualification-v1";
  i.observedAt = "2025-10-05T12:00:00Z";
  i.games = i.games.map((g) => ({
    ...g,
    season: 2025,
    date: "2025-10-04T20:00Z",
    observedAt: i.observedAt,
  }));
  i.editions = i.editions.map((e) => ({
    ...e,
    season: 2025,
    date: "2025-09-28T07:00Z",
  }));
  const raw = Buffer.from("archival fixture"),
    blob = createHash("sha1")
      .update("blob " + raw.length + "\0")
      .update(raw)
      .digest("hex");
  const v = { sha: "a".repeat(40), blob, date: i.observedAt, inputs: i };
  assert.equal(verifyGitVintage(v, raw).valid, true);
  assert.equal(verifyGitVintage(v, Buffer.from("altered")).valid, false);
  const changed = structuredClone(v);
  changed.inputs.games[0].date = "2025-10-06T00:00Z";
  assert.equal(verifyGitVintage(changed, raw).valid, false);
  changed.inputs.games[0].date = "2025-10-04T20:00Z";
  changed.inputs.editions[0].date = "2025-10-05T07:00Z";
  assert.equal(verifyGitVintage(changed, raw).valid, false);
});
test("future holdout winners cannot alter previously computed historical forecasts", () => {
  const i = input();
  i.season = 2025;
  i.rulesVersion = "historical-resume-no-qualification-v1";
  i.observedAt = "2025-10-05T12:00:00Z";
  i.games = i.games.map((g) => ({
    ...g,
    season: 2025,
    date: "2025-10-04T20:00Z",
    observedAt: i.observedAt,
  }));
  i.editions = i.editions.map((e) => ({
    ...e,
    season: 2025,
    date: "2025-09-28T07:00Z",
  }));
  const next = structuredClone(i);
  next.observedAt = "2025-10-12T12:00:00Z";
  next.games.push({
    ...game("99", "1", "4", "4"),
    season: 2025,
    date: "2025-10-08T20:00Z",
    observedAt: next.observedAt,
  });
  const wrap = (inputs: Inputs) => ({
    sha: "a".repeat(40),
    blob: "b".repeat(40),
    date: inputs.observedAt,
    inputs,
  });
  const first = historicalComparison([wrap(i), wrap(next)]);
  next.games.at(-1)!.winner = "1";
  next.games.at(-1)!.scores = [24, 17];
  const second = historicalComparison([wrap(i), wrap(next)]);
  assert.deepEqual(
    first.results[0].models.map((m) => m.snapshotId),
    second.results[0].models.map((m) => m.snapshotId),
  );
  assert.notEqual(first.aggregate[0].correct, second.aggregate[0].correct);
  assert.equal(first.selectionAccuracyValidated, false);
});
test("Pac-12 flex rematches never become conference games; other seasons and dates unaffected", () => {
  assert.equal(isPac12FlexGame(2026, "2026-11-28T22:00Z", "9", "9"), true);
  assert.equal(isPac12FlexGame(2025, "2025-11-28T22:00Z", "9", "9"), false);
  const teams = [
    { id: "36", name: "CSU", conference: "9", eligible: true },
    { id: "68", name: "Boise", conference: "9", eligible: true },
  ];
  const e = {
    id: "401860926",
    date: "2026-11-28T05:00Z",
    status: { type: { state: "pre", completed: false } },
    competitions: [
      { competitors: [{ team: { id: "36" } }, { team: { id: "68" } }] },
    ],
  };
  assert.equal(
    gameFromEspn(e, 2026, at, "fixture", teams)?.conferenceGame,
    false,
  );
  e.date = "2026-10-24T22:00Z";
  e.id = "123";
  assert.equal(
    gameFromEspn(e, 2026, at, "fixture", teams)?.conferenceGame,
    true,
  );
});
test("conference resolver selects clear terminal participants; midseason cannot award berths", () => {
  const i = input();
  const r = resolveConference(i, "8", "sec-current", {
    regularSeasonComplete: true,
  });
  assert.deepEqual(r.participants, ["1", "2"]);
  assert.equal(
    resolveConference(i, "8", "sec-current", { regularSeasonComplete: false })
      .participants.length,
    0,
  );
  i.teams[0].eligible = null;
  assert.equal(
    resolveConference(i, "8", "sec-current", { regularSeasonComplete: true })
      .participants.length,
    0,
  );
});
test("three-way cycle stops at missing SportSource, not model score or synthetic draw", () => {
  const i = input("1");
  i.games = [
    game("1", "1", "2", "1"),
    game("2", "2", "3", "2"),
    game("3", "3", "1", "3"),
  ];
  const r = resolveConference(i, "1", "acc-2026", {
    regularSeasonComplete: true,
  });
  assert.equal(r.participants.length, 0);
  assert.ok(r.issues.some((x) => x.includes("team-success unavailable")));
  const q = resolveConference(i, "1", "acc-2026", {
    regularSeasonComplete: true,
    external: {
      asOf: at,
      source: "https://official.example/fixture",
      metric: "team-success",
      direction: "lower",
      values: { "1": 1, "2": 2, "3": 3 },
    },
  });
  assert.deepEqual(q.participants, ["1", "2"]);
});
test("SEC highest common opponent honors head-to-head inside a lower tied standings group", () => {
  const i = input();
  i.games = [
    game("1", "3", "1", "3"),
    game("2", "3", "2", "3"),
    game("3", "3", "4", "3"),
    game("4", "1", "4", "1"),
    game("5", "1", "5", "5"),
    game("6", "2", "4", "4"),
    game("7", "2", "5", "2"),
    game("8", "4", "5", "4"),
    game("9", "5", "6", "5"),
  ];
  let n = 30;
  for (const id of ["1", "2"])
    for (let k = 0; k < 3; k++) i.games.push(game(String(n++), id, "6", id));
  const r = resolveConference(i, "8", "sec-current", {
    regularSeasonComplete: true,
  });
  assert.deepEqual(r.participants, ["3", "1"]);
  assert.ok(r.trace.some((t) => t.step === "highest-common"));
});
test("Big 12 does not invent eligible wins, proprietary ratings or a coin toss", () => {
  const i = input("4");
  i.games = [
    game("1", "1", "2", "1"),
    game("2", "2", "3", "2"),
    game("3", "3", "1", "3"),
  ];
  const r = resolveConference(i, "4", "big12-current", {
    regularSeasonComplete: true,
  });
  assert.equal(r.participants.length, 0);
  assert.ok(r.issues.some((x) => x.includes("eligible-win")));
  const q = resolveConference(i, "4", "big12-current", {
    regularSeasonComplete: true,
    eligibleWins: { "1": 1, "2": 1, "3": 1 },
  });
  assert.ok(q.issues.some((x) => x.includes("SportSource")));
  const z = resolveConference(i, "4", "big12-current", {
    regularSeasonComplete: true,
    eligibleWins: { "1": 1, "2": 1, "3": 1 },
    external: {
      asOf: at,
      source: "https://official.example/fixture",
      metric: "team-rating",
      direction: "lower",
      values: { "1": 1, "2": 1, "3": 1 },
    },
  });
  assert.ok(z.issues.some((x) => x.includes("draw unresolved")));
});
test("ACC unequal schedules and unconfirmed Big Ten carry-forward stay withheld", () => {
  const i = input("1");
  i.games = [
    game("1", "1", "4", "1"),
    game("2", "1", "5", "1"),
    game("3", "2", "4", "2"),
    game("4", "3", "4", "3"),
    game("5", "1", "6", "1"),
    game("6", "2", "5", "2"),
  ];
  const r = resolveConference(i, "1", "acc-2026", {
    regularSeasonComplete: true,
  });
  assert.ok(r.issues.some((x) => x.includes("alternate-schedule")));
  assert.equal(r.participants.length, 0);
  assert.ok(
    resolveConference(input("5"), "5", "bigten-2024-carry-forward", {
      regularSeasonComplete: true,
    }).issues.some((x) => x.includes("2026")),
  );
});
test("ACC official 8-1 / 7-1 / 7-2 scenarios do not turn a non-transitive tie into one group", () => {
  const i = input("1");
  i.games = [game("h1", "1", "2", "2"), game("h2", "2", "3", "3")];
  let n = 100;
  const fill = (id: string, w: number, l: number) => {
    for (let x = 0; x < w; x++) i.games.push(game(String(n++), id, "25", id));
    for (let x = 0; x < l; x++) i.games.push(game(String(n++), id, "25", "25"));
  };
  fill("1", 8, 0);
  fill("2", 6, 0);
  fill("3", 6, 2);
  // Two available berths: 7-1 wins its direct comparison, then 8-1 beats 7-2 on percentage.
  assert.deepEqual(
    resolveConference(i, "1", "acc-2026", { regularSeasonComplete: true })
      .participants,
    ["2", "1"],
  );
  // With 9-0 already in, the 7-1 survivor must next face the 7-2 team, which beat it.
  fill("4", 9, 0);
  const r = resolveConference(i, "1", "acc-2026", {
    regularSeasonComplete: true,
  });
  assert.deepEqual(r.participants, ["4", "3"]);
  assert.ok(
    r.trace.some((t) => t.step === "ACC alternate-schedule continuation"),
  );
});
test("eligibility requires season/time-specific evidence; membership never implies eligible", () => {
  const ts = input().teams.map((t) => ({ ...t, eligible: null }));
  const e = {
    id: "1",
    season: 2026,
    status: "eligible" as const,
    source: "https://official.example/fixture",
    publishedAt: at,
    observedAt: at,
    reason: "fixture",
  };
  const r = applyEligibility(ts, [e], 2026, at);
  assert.equal(r.teams[0].eligible, true);
  assert.equal(r.teams[1].eligible, null);
  assert.equal(
    applyEligibility(ts, [{ ...e, season: 2025 }], 2026, at).teams[0].eligible,
    null,
  );
  assert.equal(
    applyEligibility(
      ts,
      [{ ...e, status: "ineligible", observedAt: "2026-10-26T00:00Z" }],
      2026,
      at,
    ).teams[0].eligible,
    null,
  );
  assert.equal(
    applyEligibility(ts, [e, { ...e, status: "ineligible" }], 2026, at).teams[0]
      .eligible,
    null,
  );
});
test("actual high command day blocks activation despite apparently low monthly usage", () => {
  const b = {
    observedAt: at,
    redisMonthlyLimit: 500000,
    redisCommandsUsed: 36000,
    redisCommandsPerDay: [18739],
    storageBytesUsed: 15000000,
    storageLimitBytes: 250000000,
    qstashDailyLimit: 500,
    qstashDailyAttempts: 360,
    vercelCpuHoursUsed: 703 / 3600,
    vercelCpuHoursLimit: 4,
  };
  const r = assessOperations(b, 1, 300, 300.8);
  assert.equal(r.safeToActivate, false);
  assert.equal(r.extraSchedules, 0);
  assert.equal(r.extraQstashDeliveries, 0);
  assert.ok(r.issues.some((x) => x.includes("Redis")));
});
test("shadow session retains exact receipts, suppresses no-op history and updates all affected teams", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-shadow-session-"));
  try {
    const s = new ShadowSession(dir),
      v = vintage();
    const a = s.ingest(v);
    assert.equal(a.changed, true);
    assert.equal(a.snapshots, 2);
    const b = s.ingest(v);
    assert.equal(b.changed, false);
    assert.equal(b.snapshots, 2);
    assert.equal(s.receipts().length, 1);
    assert.equal(s.receipts()[0].inputHash, v.inputHash);
    const next = vintage();
    next.receivedAt = next.inputs.observedAt = "2026-10-25T17:04:00Z";
    next.inputs.games.push({
      ...game("14", "1", "4", "4"),
      observedAt: next.receivedAt,
    });
    next.inputHash = hash(next.inputs);
    const c = s.ingest(next);
    assert.equal(c.changed, true);
    assert.ok(c.movements.length > 2);
    assert.equal(s.receipts().length, 2);
    assert.equal(c.redisCommands, 0);
    assert.equal(c.qstashDeliveries, 0);
    assert.throws(() => s.ingest(v), /Out-of-order/);
    fs.writeFileSync(path.join(dir, "session.lock"), "");
    assert.throws(() => s.ingest(next), /busy/);
    fs.unlinkSync(path.join(dir, "session.lock"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("shadow storage budget rejects before changing head or retained snapshots", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-shadow-budget-"));
  try {
    const s = new ShadowSession(dir);
    s.ingest(vintage());
    const head = fs.readFileSync(path.join(dir, "head.json"), "utf8");
    assert.throws(
      () => s.ingest(vintage(), { reserveBytes: 64 * 1024 * 1024 }),
      /budget/,
    );
    assert.equal(fs.readFileSync(path.join(dir, "head.json"), "utf8"), head);
    assert.equal(s.receipts().length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a transient scheduled/live regression cannot erase a verified final; valid correction replaces it", () => {
  const old = game("7", "1", "2", "1");
  const later = {
    ...game("7", "1", "2", "1", "pre"),
    observedAt: "2026-10-25T17:04:00Z",
  };
  assert.equal(mergeLedger([old], [later])[0].winner, "1");
  assert.equal(
    mergeLedger(
      [old],
      [
        {
          ...later,
          state: "post",
          completed: true,
          scores: [null, null],
          winner: null,
        },
      ],
    )[0].winner,
    "1",
  );
  const corrected = {
    ...game("7", "1", "2", "2"),
    observedAt: later.observedAt,
  };
  assert.equal(mergeLedger([old], [corrected])[0].winner, "2");
  assert.equal(mergeLedger([old], [corrected]).length, 1);
});
test("live assumption expiry creates a new provisional snapshot without changing actual records", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-shadow-expiry-"));
  try {
    const s = new ShadowSession(dir),
      v = vintage();
    v.inputs.games.push(game("88", "1", "4", "4", "in"));
    v.inputHash = hash(v.inputs);
    const first = s.ingest(v);
    const next = structuredClone(v);
    next.receivedAt = next.inputs.observedAt = "2026-10-25T17:03:00Z";
    next.inputHash = hash(next.inputs);
    const later = s.ingest(next);
    assert.equal(later.changed, true);
    assert.equal(first.head.confirmed, later.head.confirmed);
    assert.notEqual(first.head.provisional, later.head.provisional);
    assert.equal(
      s.archive.restore(later.head.provisional).assumptions.length,
      0,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("clock-only and same-leader score updates do not grow shadow history", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-shadow-clock-"));
  try {
    const s = new ShadowSession(dir),
      v = vintage();
    v.inputs.games.push(game("89", "1", "4", "4", "in"));
    v.inputHash = hash(v.inputs);
    const a = s.ingest(v);
    const n = structuredClone(v);
    n.receivedAt = n.inputs.observedAt = "2026-10-25T17:01:00Z";
    n.inputs.games.at(-1)!.clock = 180;
    n.inputs.games.at(-1)!.scores = [17, 31];
    n.inputs.games.at(-1)!.observedAt = n.receivedAt;
    n.inputHash = hash(n.inputs);
    const b = s.ingest(n);
    assert.equal(b.changed, false);
    assert.equal(b.snapshots, a.snapshots);
    assert.equal(s.receipts().length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
