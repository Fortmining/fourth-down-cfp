import assert from "node:assert/strict";
import test from "node:test";
import { fitGameCoefficient, gameProbability, gameStrengths } from "../app/lib/playoff/game-prediction.ts";
import { runSeasonDraws } from "../app/lib/playoff/season-draws.ts";
import type { Inputs } from "../app/lib/playoff/types.ts";

test("future-observed final revisions cannot leak into pregame strengths", () => {
  const at = "2025-11-01T18:00:00Z";
  const input: Inputs = {
    season: 2025, observedAt: at,
    teams: ["1", "2"].map(id => ({ id, name: id, conference: "8", eligible: null })),
    editions: [], coverage: { complete: true, issues: [] },
    rulesVersion: "historical-resume-no-qualification-v1",
    games: [{
      id: "a", season: 2025, date: "2025-11-01T14:00:00Z",
      state: "post", completed: true, teams: ["1", "2"], scores: [14, 7],
      winner: "1", conferenceGame: true, period: null, clock: null,
      observedAt: "2025-11-01T18:00:01Z", source: "test",
    }],
  };
  assert.equal(gameStrengths(input).colley.get("1"), 0.5);
  input.games[0].observedAt = at;
  assert.ok(gameStrengths(input).colley.get("1")! > 0.5);
});

test("fitted strength probabilities are symmetric with a neutral matchup at one half", () => {
  const weight = fitGameCoefficient([{ difference: 0.4, won: 1 }, { difference: -0.4, won: 0 }]);
  assert.ok(weight > 0);
  assert.equal(gameProbability(0, weight), 0.5);
  assert.ok(Math.abs(gameProbability(0.4, weight) + gameProbability(-0.4, weight) - 1) < 1e-12);
});

test("seeded forced scenarios preserve every unrelated draw and reject unknown winners", () => {
  const games = [
    { id: "b", teams: ["3", "4"] as const, firstTeamWinProbability: 0.6 },
    { id: "a", teams: ["1", "2"] as const, firstTeamWinProbability: 0.4 },
  ];
  const baseline: string[][] = [];
  const forced: string[][] = [];
  const options = { trials: 1000, seed: 2026 };
  runSeasonDraws(games, options, row => baseline.push([...row]));
  runSeasonDraws([...games].reverse(), { ...options, picks: new Map([["a", "1"]]) }, row => forced.push([...row]));
  assert.ok(baseline.some(row => row[0] === "2"));
  assert.ok(forced.every((row, index) => row[0] === "1" && row[1] === baseline[index][1]));
  assert.throws(() => runSeasonDraws(games, { ...options, picks: new Map([["a", "4"]]) }, () => {}));
});
