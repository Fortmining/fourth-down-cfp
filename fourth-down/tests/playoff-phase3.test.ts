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
