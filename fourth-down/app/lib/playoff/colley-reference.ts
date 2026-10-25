import { mergeLedger, validFinal } from "./ledger.ts";
import type { Inputs } from "./types";
// Independent research control, not published Colley rankings or playoff probabilities.
// Method: https://www.colleyrankings.com/matrate.pdf . FBS-versus-FBS results only.
export function colleyReference(input: Inputs) {
  const teams = [...input.teams].sort((a, b) => Number(a.id) - Number(b.id)),
    n = teams.length;
  if (new Set(teams.map((t) => t.id)).size !== n)
    throw Error("Duplicate team identities");
  const index = new Map(teams.map((t, i) => [t.id, i]));
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)),
    ),
    b = Array<number>(n).fill(1);
  let excludedFcsGames = 0,
    usedGames = 0;
  for (const game of mergeLedger([], input.games)) {
    if (
      game.season !== input.season ||
      !validFinal(game, Date.parse(input.observedAt))
    )
      continue;
    const a = index.get(game.teams[0]),
      c = index.get(game.teams[1]);
    if (a === undefined || c === undefined) {
      excludedFcsGames++;
      continue;
    }
    usedGames++;
    matrix[a][a]++;
    matrix[c][c]++;
    matrix[a][c]--;
    matrix[c][a]--;
    const winner = index.get(game.winner!)!;
    b[winner] += 0.5;
    b[winner === a ? c : a] -= 0.5;
  }
  const original = matrix.map((row) => [...row]),
    rhs = [...b];
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(matrix[r][col]) > Math.abs(matrix[pivot][col])) pivot = r;
    if (Math.abs(matrix[pivot][col]) < 1e-12)
      throw Error("Singular reference matrix");
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = col + 1; r < n; r++) {
      const factor = matrix[r][col] / matrix[col][col];
      for (let k = col; k < n; k++) matrix[r][k] -= factor * matrix[col][k];
      b[r] -= factor * b[col];
    }
  }
  const rating = Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let value = b[i];
    for (let j = i + 1; j < n; j++) value -= matrix[i][j] * rating[j];
    rating[i] = value / matrix[i][i];
  }
  const residualMax = n
    ? Math.max(
        ...original.map((row, i) =>
          Math.abs(row.reduce((s, v, j) => s + v * rating[j], 0) - rhs[i]),
        ),
      )
    : 0;
  const rows = teams
    .map((t, i) => ({ id: t.id, name: t.name, position: 0, rating: rating[i] }))
    .sort((a, b) => b.rating - a.rating || Number(a.id) - Number(b.id));
  rows.forEach((r, i) => (r.position = i + 1));
  return {
    method: "colley-fbs-reference-v1",
    shadow: true,
    fieldWithheld: true,
    probabilities: false,
    usedGames,
    excludedFcsGames,
    residualMax,
    rows,
  };
}
