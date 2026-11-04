import { colleyReference } from "./colley-reference.ts";
import { mergeLedger, validFinal } from "./ledger.ts";
import type { Inputs } from "./types.ts";

export function gameStrengths(input: Inputs) {
  const cutoff = Date.parse(input.observedAt);
  if (!Number.isFinite(cutoff)) throw new Error("Invalid forecast cutoff");
  const games = mergeLedger([], input.games.filter(game =>
    Date.parse(game.observedAt) <= cutoff
  )).filter(game => game.season === input.season && validFinal(game, cutoff));
  const colley = new Map(colleyReference({ ...input, games }).rows.map(row => [row.id, row.rating]));
  const records = new Map(input.teams.map(team => [team.id, { wins: 1, games: 2 }]));
  for (const game of games) {
    if (!game.teams.every(id => records.has(id))) continue;
    for (const id of game.teams) {
      const record = records.get(id)!;
      record.games++;
      record.wins += Number(game.winner === id);
    }
  }
  return { colley, winRate: new Map([...records].map(([id, r]) => [id, r.wins / r.games])) };
}

type Example = { difference: number; won: 0 | 1 };
export function gameProbability(difference: number, coefficient: number) {
  return 1 / (1 + Math.exp(-difference * coefficient));
}

// A regularized logistic fit. A neutral-strength matchup is symmetric.
export function fitGameCoefficient(examples: Example[]) {
  if (!examples.length || examples.some(row => !Number.isFinite(row.difference))) {
    throw new Error("Game fit needs finite training data");
  }
  let coefficient = 0;
  for (let iteration = 0; iteration < 30; iteration++) {
    let gradient = coefficient;
    let curvature = 1;
    for (const row of examples) {
      const probability = gameProbability(row.difference, coefficient);
      gradient += (probability - row.won) * row.difference;
      curvature += probability * (1 - probability) * row.difference ** 2;
    }
    const next = Math.max(0, coefficient - gradient / curvature);
    if (Math.abs(next - coefficient) < 1e-9) return next;
    coefficient = next;
  }
  return coefficient;
}
