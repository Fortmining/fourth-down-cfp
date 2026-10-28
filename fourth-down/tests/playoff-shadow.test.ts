import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runShadow,
  candidates,
  compareSnapshots,
  hash,
} from "../app/lib/playoff/engine.ts";
import {
  currentRecords,
  mergeLedger,
  validFinal,
} from "../app/lib/playoff/ledger.ts";
import { standingsTeams, gameFromEspn } from "../app/lib/playoff/espn.ts";
import { allocateShadowField } from "../app/lib/playoff/qualification.ts";
import {
  displayRecord,
  currentRecordMap,
} from "../app/lib/playoff/record-view.ts";
import type { GameRevision, Inputs } from "../app/lib/playoff/types.ts";
const at = "2026-10-25T03:00:00Z";
function game(
  id: string,
  a: string,
  b: string,
  win: string,
  state: "pre" | "in" | "post" = "post",
): GameRevision {
  return {
    id,
    season: 2026,
    date: "2026-10-24T20:00:00Z",
    state,
    completed: state === "post",
    teams: [a, b],
    scores: win === a ? [24, 17] : [17, 24],
    winner: state === "post" ? win : null,
    conferenceGame: false,
    period: 4,
    clock: 240,
    observedAt: at,
    source: "fixture",
  };
}
function inputs(): Inputs {
  return {
    season: 2026,
    observedAt: at,
    teams: Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      name: "Team " + (i + 1),
      conference: String(
        i % 4 === 0 ? 8 : i % 4 === 1 ? 1 : i % 4 === 2 ? 4 : 5,
      ),
      eligible: true,
    })),
    games: [
      game("1", "1", "2", "1"),
      game("2", "3", "4", "3"),
      game("3", "2", "3", "2"),
      game("4", "4", "5", "4"),
      game("5", "6", "1", "1"),
    ],
    editions: [
      {
        id: "ap",
        season: 2026,
        date: "2026-10-18T07:00Z",
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
test("canonical records update wins/losses and multiple finals without changing published editions", () => {
  const i = inputs(),
    frozen = JSON.stringify(i.editions),
    before = currentRecords(i);
  assert.equal(before["1"].overall, "2-0");
  i.games.push(game("6", "1", "3", "3"));
  assert.equal(currentRecords(i)["1"].overall, "2-1");
  i.games.push(game("7", "1", "4", "1"));
  assert.equal(currentRecords(i)["1"].overall, "3-1");
  assert.equal(JSON.stringify(i.editions), frozen);
});
test("ledger deduplicates two feeds, ignores older revisions and replaces corrected results", () => {
  const g = game("6", "1", "2", "1");
  let ledger = mergeLedger([g], [g]);
  assert.equal(ledger.length, 1);
  const correction = {
    ...game("6", "1", "2", "2"),
    observedAt: "2026-10-25T03:01:00Z",
  };
  ledger = mergeLedger(ledger, [correction, g]);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].winner, "2");
  const i = inputs();
  i.games = ledger;
  i.observedAt = correction.observedAt;
  assert.equal(currentRecords(i)["1"].overall, "0-1");
});
test("invalid/unverified finals, wrong season and future games cannot fabricate actual records", () => {
  const i = inputs();
  i.games = [
    { ...game("1", "1", "2", "1"), winner: null },
    { ...game("2", "1", "2", "1"), completed: false },
    { ...game("3", "1", "2", "1"), scores: [null, 0] },
    { ...game("4", "1", "2", "1"), season: 2025 },
    { ...game("5", "1", "2", "1"), date: "2026-11-01T00:00Z" },
  ];
  assert.equal(currentRecords(i)["1"].overall, "0-0");
  assert.equal(validFinal(i.games[0]), false);
});
test("live overlay recalculates competitors without mutating confirmed records and a final replaces the assumption", () => {
  const i = inputs();
  i.games.push(game("6", "2", "4", "4", "in"));
  const frozen = JSON.stringify(i),
    confirmed = runShadow(i),
    live = runShadow(i, candidates[0], true, confirmed.id);
  assert.equal(live.assumptions.length, 1);
  assert.equal(live.rows.find((r) => r.id === "4")!.record, "2-1");
  assert.equal(confirmed.rows.find((r) => r.id === "4")!.record, "1-1");
  assert.ok(
    compareSnapshots(confirmed, live).some((x) => !["2", "4"].includes(x.id)),
  );
  assert.equal(JSON.stringify(i), frozen);
  i.games[i.games.length - 1] = game("6", "2", "4", "4");
  const final = runShadow(i);
  assert.equal(final.rows.find((r) => r.id === "4")!.record, "2-1");
  assert.equal(runShadow(i, candidates[0], true).assumptions.length, 0);
});
test("stale live data, tied scores, malformed/premature periods withhold hypothetical outcomes", () => {
  for (const patch of [
    { observedAt: "2026-10-25T02:50Z" },
    { scores: [14, 14] as [number, number] },
    { period: 4, date: "2026-10-25T02:50Z" },
    { period: 5, date: "2026-10-25T02:00Z" },
    { period: null },
  ]) {
    const i = inputs();
    i.games.push({ ...game("8", "1", "4", "1", "in"), ...patch });
    assert.equal(runShadow(i, candidates[0], true).assumptions.length, 0);
  }
});
test("global opponent strength changes move uninvolved teams after an upset", () => {
  const i = inputs(),
    before = runShadow(i);
  i.games.push(game("9", "3", "6", "6"));
  const after = runShadow(i),
    changes = compareSnapshots(before, after);
  assert.ok(changes.some((r) => !["3", "6"].includes(r.id)));
  assert.ok(changes.some((r) => r.componentDeltas.S !== 0));
});
test("new published CFP edition changes anchor; archived AP edition and snapshot stay immutable", () => {
  const i = inputs(),
    before = runShadow(i),
    frozen = JSON.stringify(before);
  i.editions.push({
    id: "cfp",
    date: "2026-10-25T02:00Z",
    season: 2026,
    ranks: i.editions[0].ranks.map((r, j) => ({ ...r, rank: 25 - j })),
  });
  const after = runShadow(i);
  assert.equal(after.anchorIds[0], "cfp:2026-10-25T02:00Z");
  assert.ok(compareSnapshots(before, after).some((x) => x.anchorChanged));
  assert.equal(JSON.stringify(before), frozen);
  assert.equal(before.inputs.editions.length, 1);
});
test("same inputs replay exactly; refresh-only timestamps do not create model movement; model versions cannot mix", () => {
  const i = inputs(),
    a = runShadow(i),
    b = runShadow(structuredClone(i));
  assert.equal(hash(a), hash(b));
  const newer = { ...i, observedAt: "2026-10-25T03:01Z" };
  assert.equal(runShadow(newer).id, a.id);
  assert.notEqual(runShadow(newer).inputHash, a.inputHash);
  assert.deepEqual(compareSnapshots(a, runShadow(newer)), []);
  assert.throws(
    () => compareSnapshots(a, runShadow(i, candidates[1])),
    /Incompatible/,
  );
});
test("missing/expired baseline, incomplete coverage and record conflicts explicitly block a field", () => {
  const i = inputs();
  i.editions = [];
  i.coverage.complete = false;
  i.teams[0].reportedRecord = "6-1";
  const s = runShadow(i);
  assert.equal(s.field.definitive, false);
  assert.ok(s.issues.includes("No valid published baseline"));
  assert.ok(s.issues.includes("Incomplete season coverage"));
  assert.ok(s.issues.some((x) => x.includes("Record reconciliation")));
});
test("recursive standings keep Sun Belt members in their parent conference and parse totals by unique stat name", () => {
  const teams = standingsTeams({
    children: [
      {
        id: "37",
        children: [
          {
            id: "east",
            standings: {
              entries: [
                {
                  team: { id: "1", displayName: "One" },
                  stats: [
                    { name: "wins", displayValue: "8" },
                    { name: "overall", displayValue: "6-2" },
                    { name: "vs. Conf.", displayValue: "3-1" },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.equal(teams[0].conference, "37");
  assert.equal(teams[0].reportedRecord, "6-2");
  assert.equal(teams[0].eligible, null);
});
test("ESPN source adapter preserves real missing scores and rejects fabricated winners", () => {
  const raw = {
    id: "123",
    date: "2026-10-24T20:00Z",
    status: { type: { state: "post", completed: true } },
    competitions: [
      {
        competitors: [
          { team: { id: "1" }, score: "", winner: true },
          { team: { id: "2" }, score: "17", winner: true },
        ],
      },
    ],
  };
  const g = gameFromEspn(raw, 2026, at, "fixture", inputs().teams)!;
  assert.equal(g.scores[0], null);
  assert.equal(g.winner, null);
  assert.equal(validFinal(g), false);
});
test("current record join cannot regress to a future-game pregame record or change official snapshots", () => {
  const map = currentRecordMap(
    [{ id: "1", reportedRecord: "6-2", reportedConferenceRecord: "3-2" }],
    [
      { date: "2026-10-24", teams: [{ id: "1", record: "6-2" }] },
      { date: "2026-11-01", teams: [{ id: "1", record: "6-1" }] },
    ],
    at,
  );
  assert.equal(displayRecord("1", map), "6-2");
  assert.equal(displayRecord("2", map), "");
  assert.equal(map["1"].conference, "3-2");
});
test("2026 shadow field reserves Power Four, a non-champion six-conference team, and protected Notre Dame before at-large seeding", () => {
  const i = inputs();
  i.teams.find((t) => t.id === "25")!.conference = "151";
  i.teams.push({
    id: "87",
    name: "Notre Dame",
    conference: "18",
    eligible: true,
  });
  let rows = runShadow(i).rows;
  rows = rows.filter((r) => r.id !== "87");
  rows.splice(8, 0, { ...rows[0], id: "87", name: "Notre Dame" });
  rows.forEach((r, j) => (r.position = j + 1));
  const champions = Object.fromEntries(
    ["1", "4", "5", "8"].map((c) => [
      c,
      i.teams.find((t) => t.conference === c)!.id,
    ]),
  );
  champions["8"] = "29";
  const result = allocateShadowField(rows, i.teams, champions, true);
  assert.deepEqual(result.issues, []);
  assert.equal(result.field.length, 12);
  assert.ok(result.field.some((r) => r.id === "25"));
  assert.ok(result.field.some((r) => r.id === "29"));
  assert.match(result.field.find((r) => r.id === "87")!.reason, /Notre Dame/);
  assert.deepEqual(
    result.field.filter((r) => r.bye).map((r) => r.seed),
    [1, 2, 3, 4],
  );
  assert.equal(
    result.field.find((r) => r.seed === 5)!.firstRoundOpponentSeed,
    12,
  );
  assert.equal(result.definitive, false);
  assert.equal(
    allocateShadowField(rows, i.teams, champions, false).field.length,
    0,
  );
});
test("ineligible teams cannot displace eligible teams or defeat the Notre Dame top-12 condition", () => {
  const i = inputs();
  i.teams[0].eligible = false;
  i.teams.find((t) => t.id === "25")!.conference = "151";
  i.teams.push({
    id: "87",
    name: "Notre Dame",
    conference: "18",
    eligible: true,
  });
  const rows = runShadow(i).rows.filter((r) => r.id !== "87");
  rows.splice(12, 0, { ...rows[0], id: "87", name: "Notre Dame" });
  rows.forEach((r, j) => (r.position = j + 1));
  const result = allocateShadowField(
    rows,
    i.teams,
    { "1": "2", "4": "3", "5": "4", "8": "5" },
    true,
  );
  assert.deepEqual(result.issues, []);
  assert.ok(!result.field.some((r) => r.id === "1"));
  assert.match(result.field.find((r) => r.id === "87")!.reason, /Notre Dame/);
  assert.equal(result.field.find((r) => r.id === "87")!.selectionPosition, 12);
});
test("unassigned ESPN participants are not normalized as fictional opponent teams", () => {
  const e = {
    id: "123",
    date: "2026-12-05T00:00Z",
    status: { type: { state: "pre", completed: false } },
    competitions: [
      {
        competitors: [
          { team: { id: "-1" }, score: "0" },
          { team: { id: "-2" }, score: "0" },
        ],
      },
    ],
  };
  assert.equal(gameFromEspn(e, 2026, at, "fixture", inputs().teams), null);
});
test("incomplete future opponents withhold remaining difficulty without changing confirmed records", () => {
  const i = inputs();
  i.games.push({
    ...game("10", "1", "2", "1", "pre"),
    date: "2026-11-01T20:00Z",
  });
  const before = runShadow(i);
  assert.notEqual(
    before.rows.find((r) => r.id === "1")!.remainingDifficulty,
    null,
  );
  i.coverage.futureComplete = false;
  i.pendingGames = [
    {
      id: "11",
      name: "TBD at One",
      date: "2026-11-28T20:00Z",
      knownTeamIds: ["1"],
      observedAt: at,
      source: "fixture",
    },
  ];
  const after = runShadow(i);
  assert.equal(after.rows.find((r) => r.id === "1")!.remainingDifficulty, null);
  assert.equal(
    after.rows.find((r) => r.id === "1")!.record,
    before.rows.find((r) => r.id === "1")!.record,
  );
  assert.ok(
    after.issues.some((x) => x.includes("Future participants unresolved")),
  );
});
