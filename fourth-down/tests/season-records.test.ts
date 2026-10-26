import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchRecordLedger,
  reconcileSeasonRecords,
  type RecordLedger,
} from "../app/lib/season-records.ts";
import { gameFromEspn } from "../app/lib/playoff/espn.ts";
import type { GameRevision, TeamSeason } from "../app/lib/playoff/types.ts";
const at = "2026-10-25T22:00:00Z";
const teams: TeamSeason[] = [
  {
    id: "1",
    name: "Alpha",
    conference: "8",
    eligible: null,
    reportedRecord: "1-0",
    reportedConferenceRecord: "1-0",
  },
  {
    id: "2",
    name: "Beta",
    conference: "8",
    eligible: null,
    reportedRecord: "0-1",
    reportedConferenceRecord: "0-1",
  },
];
const final: GameRevision = {
  id: "10",
  season: 2026,
  date: "2026-10-10T20:00Z",
  state: "post",
  completed: true,
  teams: ["1", "2"],
  scores: [24, 17],
  winner: "1",
  conferenceGame: true,
  period: 4,
  clock: 0,
  observedAt: "2026-10-11T00:00Z",
  source: "verified fixture",
};
const ledger: RecordLedger = {
  season: 2026,
  throughWeek: 7,
  games: [final],
  observedAt: "2026-10-25T20:00Z",
};
test("opening-week zero records require explicit provider totals; an empty ledger alone is not evidence",()=>{
 const opening=teams.map(t=>({...t,reportedRecord:"0-0",reportedConferenceRecord:"0-0"}));
 const empty={...ledger,throughWeek:0,games:[]};
 assert.equal(reconcileSeasonRecords(opening,empty,[],at)["1"].overall,"0-0");
 assert.equal(reconcileSeasonRecords(opening,empty,[],at)["1"].status,"available");
 assert.equal(reconcileSeasonRecords(teams.map(t=>({...t,reportedRecord:undefined})),empty,[],at)["1"].status,"unavailable");
});
function game(id: string, winner = "2") {
  return {
    id,
    date: "2026-10-24T20:00Z",
    status: "post",
    completed: true,
    teams: [
      { id: "1", score: winner === "1" ? 24 : 17, winner: winner === "1" },
      { id: "2", score: winner === "2" ? 24 : 17, winner: winner === "2" },
    ],
  };
}
test("confirmed win and loss update overall/conference while standings and poll still lag", () => {
  const result = reconcileSeasonRecords(teams, ledger, [game("11")], at);
  assert.equal(result["1"].overall, "1-1");
  assert.equal(result["2"].overall, "1-1");
  assert.equal(result["1"].conference, "1-1");
  assert.equal(result["1"].status, "available");
  assert.equal(teams[0].reportedRecord, "1-0");
  const win = reconcileSeasonRecords(teams, ledger, [game("11", "1")], at);
  assert.equal(win["1"].overall, "2-0");
  assert.equal(win["2"].overall, "0-2");
});
test("multiple completed games and corrected identity count once; finals survive a transient live regression", () => {
  const result = reconcileSeasonRecords(
    teams,
    ledger,
    [
      game("11"),
      game("12"),
      game("11", "1"),
      { ...game("10"), status: "in", completed: false },
    ],
    at,
  );
  assert.equal(result["1"].overall, "2-1");
  assert.equal(result["1"].conference, "2-1");
});
test("invalid scores and future finals never increment records", () => {
  const bad = game("11");
  bad.teams[0].score = NaN;
  assert.equal(
    reconcileSeasonRecords(teams, ledger, [bad], at)["1"].overall,
    "1-0",
  );
  assert.equal(
    reconcileSeasonRecords(
      teams,
      ledger,
      [{ ...game("11"), date: "2026-11-01T20:00Z" }],
      at,
    )["1"].overall,
    "1-0",
  );
  assert.throws(
    () =>
      reconcileSeasonRecords(
        teams,
        { ...ledger, observedAt: "2026-10-26T20:00Z" },
        [],
        at,
      ),
    /epoch/,
  );
});
test("missing historical results cannot publish fabricated totals; conference conflict is withheld separately", () => {
  const ahead = teams.map((t) => ({ ...t, reportedRecord: "3-1" }));
  assert.equal(
    reconcileSeasonRecords(ahead, ledger, [], at)["1"].status,
    "unavailable",
  );
  const conflict = teams.map((t) => ({
    ...t,
    reportedConferenceRecord: "0-1",
  }));
  const result = reconcileSeasonRecords(conflict, ledger, [], at);
  assert.equal(result["1"].status, "available");
  assert.equal(result["1"].conference, null);
});
test("championship and Pac-12 flex results change overall records but never regular conference records", () => {
  const result = reconcileSeasonRecords(teams, ledger, [game("401869545")], at);
  assert.equal(result["1"].overall, "1-1");
  assert.equal(result["1"].conference, "1-0");
  const raw = {
    id: "401860926",
    date: "2026-11-28T22:00Z",
    status: { type: { state: "post", completed: true } },
    competitions: [
      {
        competitors: game("9").teams.map((t) => ({
          team: { id: t.id },
          score: t.score,
          winner: t.winner,
        })),
      },
    ],
  };
  assert.equal(
    gameFromEspn(
      raw,
      2026,
      at,
      "fixture",
      teams.map((t) => ({ ...t, conference: "9" })),
    )?.conferenceGame,
    false,
  );
});
test("a new published poll never enters record calculations", () => {
  const before = structuredClone(teams);
  const result = reconcileSeasonRecords(teams, ledger, [game("11")], at);
  assert.deepEqual(teams, before);
  assert.equal(result["1"].overall, "1-1");
  assert.equal("rank" in result["1"], false);
});
test("season fetch checks each explicit week and rejects truncation, wrong seasons and invalid finals", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url) => {
      calls++;
      assert.match(String(url), /week=1&year=2026/);
      return Response.json({
        season: { year: 2026 },
        week: { number: 1 },
        events: [
          {
            id: "10",
            date: "2026-10-10T20:00Z",
            status: { type: { state: "post", completed: true } },
            competitions: [
              {
                conferenceCompetition: true,
                competitors: game("10", "1").teams.map((t) => ({
                  team: { id: t.id },
                  score: t.score,
                  winner: t.winner,
                })),
              },
            ],
          },
        ],
      });
    };
    const l = await fetchRecordLedger(2026, 1);
    assert.equal(l.games[0].conferenceGame, true);
    assert.equal(calls, 1);
    for (const raw of [
      { season: { year: 2025 }, week: { number: 1 }, events: [] },
      {
        season: { year: 2026 },
        week: { number: 1 },
        events: Array(300).fill({}),
      },
      {
        season: { year: 2026 },
        week: { number: 1 },
        events: [{ status: { type: { state: "post" } } }],
      },
    ]) {
      globalThis.fetch = async () => Response.json(raw);
      await assert.rejects(() => fetchRecordLedger(2026, 1));
    }
  } finally {
    globalThis.fetch = original;
  }
});
