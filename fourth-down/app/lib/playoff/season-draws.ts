type ForecastGame = {
  id: string;
  teams: readonly [string, string];
  firstTeamWinProbability: number;
};

export function runSeasonDraws(
  games: readonly ForecastGame[],
  options: {
    trials: number;
    seed: number;
    picks?: ReadonlyMap<string, string>;
  },
  consume: (winners: readonly string[]) => void,
) {
  const { trials, seed, picks } = options;
  if (!Number.isInteger(trials) || trials < 1 || trials > 50_000 ||
      !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || games.length > 1000) {
    throw new Error("Invalid simulation budget");
  }

  const ordered = [...games].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(ordered.map(game => [game.id, game]));
  if (byId.size !== ordered.length || ordered.some(game =>
    !game.id || !game.teams[0] || !game.teams[1] || game.teams[0] === game.teams[1] ||
    !Number.isFinite(game.firstTeamWinProbability) ||
    game.firstTeamWinProbability < 0 || game.firstTeamWinProbability > 1
  )) throw new Error("Invalid simulation fixtures");

  for (const [id, winner] of picks ?? []) {
    if (!byId.get(id)?.teams.includes(winner)) throw new Error("Invalid forced result");
  }

  let state = seed;
  for (let trial = 0; trial < trials; trial++) {
    const winners = ordered.map(game => {
      // Mulberry32. Always consume one draw, including forced games.
      // This keeps other results paired across scenario runs.
      state = (state + 0x6d2b79f5) >>> 0;
      let bits = Math.imul(state ^ (state >>> 15), state | 1);
      bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
      const draw = ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
      return picks?.get(game.id) ?? game.teams[draw < game.firstTeamWinProbability ? 0 : 1];
    });
    consume(winners);
  }
}
