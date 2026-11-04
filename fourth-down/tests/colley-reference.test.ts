import { test } from "node:test";
import assert from "node:assert/strict";
import { colleyReference } from "../app/lib/playoff/colley-reference.ts";
import { currentRecords } from "../app/lib/playoff/ledger.ts";
import type { Inputs, GameRevision } from "../app/lib/playoff/types.ts";
const game: GameRevision = {
  id: "1",
  season: 2026,
  date: "2026-10-24T20:00Z",
  state: "post",
  completed: true,
  teams: ["1", "2"],
  scores: [24, 17],
  winner: "1",
  conferenceGame: false,
  period: 4,
  clock: 0,
  observedAt: "2026-10-25T03:00Z",
  source: "fixture",
};
function input(): Inputs {
  return {
    season: 2026,
    observedAt: game.observedAt,
    teams: [
      { id: "1", name: "One", conference: "8", eligible: true },
      { id: "2", name: "Two", conference: "1", eligible: true },
    ],
    games: [structuredClone(game)],
    editions: [],
    coverage: { complete: true, issues: [] },
    rulesVersion: "cfp-2026-unverified-conference-adapters",
  };
}
test("matrix reference reproduces the analytical two-team solution and a small numerical residual", () => {
  const r = colleyReference(input());
  assert.ok(Math.abs(r.rows[0].rating - 0.625) < 1e-12);
  assert.ok(Math.abs(r.rows[1].rating - 0.375) < 1e-12);
  assert.ok(r.residualMax < 1e-12);
  assert.equal(r.probabilities, false);
  assert.equal(r.fieldWithheld, true);
});
test("reference ignores scoring margin and official poll changes", () => {
  const i = input(),
    before = colleyReference(i);
  i.games[0].scores = [63, 0];
  i.editions = [{ id: "ap", season: 2026, date: "2026-10-18", ranks: [] }];
  assert.deepEqual(colleyReference(i).rows, before.rows);
});
test("duplicate observations do not count twice and input ordering does not alter ratings", () => {
  const i = input(),
    before = colleyReference(i);
  i.games.push(structuredClone(game));
  i.teams.reverse();
  assert.deepEqual(colleyReference(i), before);
});
test("FCS exclusion is explicit in the control but does not delete a real win from canonical records", () => {
  const i = input();
  i.games = [{ ...game, teams: ["1", "999"], winner: "1" }];
  const r = colleyReference(i);
  assert.equal(r.usedGames, 0);
  assert.equal(r.excludedFcsGames, 1);
  assert.equal(r.rows[0].rating, 0.5);
  assert.equal(currentRecords(i)["1"].overall, "1-0");
});
