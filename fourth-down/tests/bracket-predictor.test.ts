import assert from "node:assert/strict";
import test from "node:test";
import { cleanBracketPicks, matchupChance, runBracket } from "../app/lib/bracket-predictor.ts";

const seeds = Array.from({length: 12}, (_, index) => String(index + 1));
const ratings = new Map(seeds.map((id, index) => [id, 28 - index * 0.75]));

test("Claude rating model favors the campus host at equal strength", () => {
  assert.ok(Math.abs(matchupChance(20, 20, false) - 0.5) < 0.00001);
  assert.ok(matchupChance(20, 20, true) > 0.5);
});

test("a changed upstream pick drops invalid downstream locks", () => {
  assert.deepEqual(cleanBracketPicks(seeds, {r1a: "5", qf2: "12", sf1: "12"}), {r1a: "5"});
  assert.deepEqual(cleanBracketPicks(seeds, {r1a: "12", qf2: "12"}), {r1a: "12", qf2: "12"});
});

test("20,000 draws honor locks and account for every playoff advancement", () => {
  const draws = 20_000;
  const { totals } = runBracket(seeds, ratings, {r1a: "12", qf2: "12"}, draws);
  assert.equal(totals["12"].semifinal, draws);
  for (const [key, appearances] of [["semifinal", 4], ["final", 2], ["champion", 1]] as const) {
    assert.equal(Object.values(totals).reduce((sum, team) => sum + team[key], 0), appearances * draws);
  }
});
