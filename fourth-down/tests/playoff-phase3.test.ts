import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEligibility } from "../app/lib/playoff/eligibility.ts";
import { requiredEvidence } from "../app/lib/playoff/evidence-requirements.ts";
import { resolveConference } from "../app/lib/playoff/conference.ts";
import {
  modelSensitivity,
  championshipContext,
} from "../app/lib/playoff/sensitivity.ts";
import {
  packSnapshotPair,
  replaySnapshotPair,
  storageWriteBudget,
} from "../app/lib/playoff/storage-plan.ts";
import { runShadow } from "../app/lib/playoff/engine.ts";
import type { Inputs, GameRevision } from "../app/lib/playoff/types.ts";
const at = "2026-12-06T12:00:00Z";
function game(id: string, a: string, b: string, winner: string): GameRevision {
  return {
    id,
    season: 2026,
    date: "2026-10-24T20:00Z",
    state: "post",
    completed: true,
    teams: [a, b],
    scores: winner === a ? [24, 17] : [17, 24],
    winner,
    conferenceGame: true,
    period: 4,
    clock: 0,
    observedAt: at,
    source: "synthetic regression fixture",
  };
}
function input(conference = "8"): Inputs {
  return {
    season: 2026,
    observedAt: at,
    rulesVersion: "cfp-2026-unverified-conference-adapters",
    teams: Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      name: "Team " + (i + 1),
      conference,
      eligible: true,
    })),
    games: [
      game("1", "1", "2", "1"),
      game("2", "1", "3", "1"),
      game("3", "2", "3", "2"),
    ],
    editions: [
      {
        id: "ap",
        date: "2026-12-01T12:00Z",
        season: 2026,
        ranks: Array.from({ length: 25 }, (_, i) => ({
          id: String(i + 1),
          rank: i + 1,
          previous: i + 1,
          record: "0-0",
        })),
      },
    ],
    coverage: { complete: true, issues: [] },
  };
}
test("academic or transition evidence alone cannot certify institutional postseason eligibility", () => {
  const i = input();
  const e = {
    id: "1",
    season: 2026,
    status: "eligible" as const,
    scope: "academic" as const,
    source: "https://web3.ncaa.org/aprsearch/aprsearch",
    publishedAt: null,
    observedAt: at,
    reason: "APR component only",
  };
  assert.equal(
    applyEligibility(i.teams, [e], 2026, at).teams[0].eligible,
    null,
  );
  assert.equal(
    applyEligibility(i.teams, [{ ...e, scope: "institutional" }], 2026, at)
      .teams[0].eligible,
    true,
  );
});
test("verified 2026 Big Ten top records resolve clear participants without claiming unconfirmed tie procedures", () => {
  const i = input("5");
  const result = resolveConference(i, "5", "bigten-2026-top-records", {
    regularSeasonComplete: true,
  });
  assert.deepEqual(result.participants, ["1", "2"]);
  assert.equal(result.definitive, false);
  i.games = [
    game("1", "1", "4", "1"),
    game("2", "2", "4", "2"),
    game("3", "3", "4", "3"),
  ];
  const tied = resolveConference(i, "5", "bigten-2026-top-records", {
    regularSeasonComplete: true,
  });
  assert.equal(tied.participants.length, 0);
  assert.match(tied.issues.join(), /full-policy confirmation/);
  assert.deepEqual(
    requiredEvidence("bigten-2026-top-records", tied.issues).requiredNow,
    ["current-full-policy-confirmation"],
  );
});
test("proprietary metrics are conditional qualification dependencies, not mandatory resume weights", () => {
  assert.deepEqual(requiredEvidence("acc-2026", []).requiredNow, []);
  assert.deepEqual(
    requiredEvidence("acc-2026", [
      "Official SportSource team-success unavailable; do not substitute model ratings",
    ]).requiredNow,
    ["team-success"],
  );
  assert.deepEqual(
    requiredEvidence("sec-current", [
      "Conference-administered draw unresolved; never synthesize coin toss",
    ]).requiredNow,
    ["conference-draw"],
  );
});
test("sensitivity reports ranges across seven frozen models, never playoff probabilities or a field", () => {
  const i = input(),
    before = structuredClone(i),
    s = modelSensitivity(i);
  assert.equal(s.models.length, 7);
  assert.ok(
    s.rows.every(
      (r) => r.minPosition <= r.maxPosition && r.top12ResumeModels <= 7,
    ),
  );
  assert.equal(s.fieldWithheld, true);
  assert.equal("probability" in s.rows[0], false);
  assert.deepEqual(i, before);
});
test("championship context requires a valid title final and eligibility; a ranked conference leader is not champion", () => {
  const i = input();
  assert.ok(
    championshipContext(i).champions.every((c) => c.confirmedChampion === null),
  );
  i.games.push(game("401869545", "1", "2", "2"));
  assert.equal(
    championshipContext(i).champions.find((c) => c.conference === "8")!
      .confirmedChampion,
    "2",
  );
  i.teams[1].eligible = null;
  assert.equal(
    championshipContext(i).champions.find((c) => c.conference === "8")!
      .confirmedChampion,
    null,
  );
});
test("compressed candidate pair replays exactly and rejects mutated identities or mixed models", () => {
  const i = input(),
    c = runShadow(i),
    p = runShadow(i, undefined, true, c.id),
    packed = packSnapshotPair(c, p);
  const replay = replaySnapshotPair(packed.encoded);
  assert.equal(replay.confirmed.id, c.id);
  assert.equal(replay.provisional.id, p.id);
  assert.ok(packed.compressedBytes < packed.rawBytes);
  assert.throws(
    () => packSnapshotPair(c, { ...p, inputHash: "bad" }),
    /share an input/,
  );
  assert.throws(() =>
    replaySnapshotPair(Buffer.from("invalid").toString("base64")),
  );
});
test("dry-run storage budget reserves notification allowance, counts reads, and never authorizes transport", () => {
  const b = storageWriteBudget(
    [{ redisValueBytes: 10000 }],
    36000,
    360000,
    15000000,
  );
  assert.equal(b.commandAllowance, 4000);
  assert.equal(b.maxPairsByCommandBudget, 800);
  assert.equal(b.periodicReadCommandsPer30DaysIfOneAddedPerCheck, 10800);
  assert.equal(b.productionActivationPermitted, false);
  assert.equal(b.transportInstalled, false);
  assert.equal(storageWriteBudget([], 500000, 0, 0).commandAllowance, 0);
  assert.throws(() => storageWriteBudget([], NaN, 0, 0));
});

test("conference scenario uses hypothetical winners without modifying confirmed games", () => {
  const i = input("5");
  i.games.push({
    ...game("future", "2", "3", "3"), date: "2026-12-06T18:00:00Z",
    state: "pre", completed: false, winner: null, scores: [null, null],
  });
  const original = JSON.stringify(i);
  const options = { regularSeasonComplete: true };
  const unresolved = resolveConference(i, "5", "bigten-2026-top-records", {
    ...options, simulatedWinners: new Map(),
  });
  assert.deepEqual(unresolved.participants, []);
  const resolved = resolveConference(i, "5", "bigten-2026-top-records", {
    ...options, simulatedWinners: new Map([["future", "2"]]),
  });
  assert.deepEqual(resolved.participants, ["1", "2"]);
  assert.equal(resolved.hypothetical, true);
  assert.equal(JSON.stringify(i), original);
});

test("championship draw resolves a verified slot without writing a score or final", async () => {
  const { simulateConferenceTitle } = await import("../app/lib/playoff/championship-trial.ts");
  const i = input("5");
  i.pendingGames = [{
    id: "401869534", name: "Big Ten championship", date: "2026-12-06T20:00:00Z",
    knownTeamIds: [], observedAt: at, source: "synthetic regression fixture",
  }];
  const options = {
    fixtureId: "401869534", policy: "bigten-2026-top-records" as const,
    conferenceScheduleComplete: true, simulatedWinners: new Map<string, string>(),
    ratings: new Map([["1", 0.5], ["2", 0.5]]),
    strengthCoefficient: 2, homeCoefficient: 0.4, verifiedVenue: { kind: "neutral" as const },
    draw: 0.4,
  };
  const original = JSON.stringify(i);
  const first = simulateConferenceTitle(i, options);
  assert.equal(first.status, "simulated");
  if (first.status === "simulated") assert.equal(first.winner, "1");
  const second = simulateConferenceTitle(i, { ...options, draw: 0.6 });
  if (second.status === "simulated") assert.equal(second.winner, "2");
  else assert.fail("Expected supported title draw");
  assert.equal(simulateConferenceTitle(i, { ...options, verifiedVenue: null }).status, "withheld");
  assert.equal(simulateConferenceTitle(i, { ...options, conferenceScheduleComplete: false }).status, "withheld");
  assert.equal(JSON.stringify(i), original);
});

test("one private playoff trial joins four title draws to twelve seeds and withholds incomplete trials", async () => {
  const { resolvePlayoffTrial } = await import("../app/lib/playoff/playoff-trial.ts");
  const i = input();
  const titles = [
    ["401858318", "1", "acc-2026"],
    ["401869533", "4", "big12-current"],
    ["401869534", "5", "bigten-2026-top-records"],
    ["401869545", "8", "sec-current"],
  ] as const;
  i.teams = i.teams.slice(0, 14).map((team, index) => ({
    ...team, conference: index < 12 ? titles[Math.floor(index / 3)][1] : "151",
  }));
  i.editions = [];
  i.games = titles.flatMap((_, index) => {
    const [a, b, c] = i.teams.slice(index * 3, index * 3 + 3).map(team => team.id);
    return [game(`${a}-${b}`, a, b, a), game(`${a}-${c}`, a, c, a), game(`${b}-${c}`, b, c, b)];
  });
  i.pendingGames = titles.map(([id]) => ({
    id, name: "Championship", date: "2026-12-06T20:00:00Z",
    knownTeamIds: [], observedAt: at, source: "synthetic regression fixture",
  }));
  const scenarios = titles.map(([fixtureId, , policy]) => ({
    fixtureId, policy, conferenceScheduleComplete: true, simulatedWinners: new Map<string, string>(),
    ratings: new Map(i.teams.map(team => [team.id, 0.5])),
    strengthCoefficient: 2, homeCoefficient: 0.4, verifiedVenue: { kind: "neutral" as const },
    draw: 0.25,
  }));
  const rows = runShadow(i).rows;
  const result = resolvePlayoffTrial(i, scenarios, () => rows);
  if (result.status !== "simulated") assert.fail(result.issues.join(", "));
  assert.deepEqual(result.champions, { "1": "1", "4": "4", "5": "7", "8": "10" });
  assert.equal(result.field.length, 12);
  assert.equal(result.firstTwoOut.length, 2);
  const withheld = resolvePlayoffTrial(i, [{ ...scenarios[0], verifiedVenue: null }, ...scenarios.slice(1)], () => {
    assert.fail("Selection model must not run with a missing champion");
  });
  assert.equal(withheld.status, "withheld");
});

test("batch accounting keeps unresolved playoff draws in the denominator", async () => {
  const { runPlayoffBatch } = await import("../app/lib/playoff/playoff-trial.ts");
  const results = [
    { status: "withheld", issues: ["Missing venue", "Missing venue"] },
    { status: "withheld", issues: ["Missing venue", "Unresolved tiebreaker"] },
  ] as const;
  const batch = runPlayoffBatch([], { trials: 2, seed: 2026 }, (_, index) => ({
    status: results[index].status,
    issues: [...results[index].issues],
  }));
  assert.equal(batch.total, 2);
  assert.equal(batch.withheld, 2);
  assert.equal(batch.complete, false);
  assert.equal(batch.withheldReasons["Missing venue"], 2);
  assert.deepEqual(Object.keys(batch.seedCounts), []);
});
