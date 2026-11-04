// Bracket topology and power-rating model adapted from the supplied Claude predictor.
export const playoffGames = [
 {id:"r1a",round:0,a:{seed:5},b:{seed:12},home:true,label:"12 at 5"},
 {id:"r1b",round:0,a:{seed:8},b:{seed:9},home:true,label:"9 at 8"},
 {id:"r1c",round:0,a:{seed:6},b:{seed:11},home:true,label:"11 at 6"},
 {id:"r1d",round:0,a:{seed:7},b:{seed:10},home:true,label:"10 at 7"},
 {id:"qf1",round:1,a:{seed:1},b:{w:"r1b"},label:"No. 1 seed's bowl"},
 {id:"qf2",round:1,a:{seed:4},b:{w:"r1a"},label:"No. 4 seed's bowl"},
 {id:"qf3",round:1,a:{seed:2},b:{w:"r1d"},label:"No. 2 seed's bowl"},
 {id:"qf4",round:1,a:{seed:3},b:{w:"r1c"},label:"No. 3 seed's bowl"},
 {id:"sf1",round:2,a:{w:"qf1"},b:{w:"qf2"},label:"Orange or Sugar"},
 {id:"sf2",round:2,a:{w:"qf3"},b:{w:"qf4"},label:"Orange or Sugar"},
 {id:"f",round:3,a:{w:"sf1"},b:{w:"sf2"},label:"Las Vegas"}
] as const;
function Phi(x: number){const t=1/(1+0.2316419*Math.abs(x)),d=0.3989423*Math.exp(-x*x/2);let p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p}

export type BracketPicks = Record<string, string>;
type Game = (typeof playoffGames)[number];
type Slot = Game["a"] | Game["b"];

export function resolveSlot(slot: Slot, seeds: readonly string[], picks: BracketPicks) {
  return "seed" in slot ? seeds[slot.seed - 1] : picks[slot.w];
}

export function matchupChance(a: number, b: number, campus: boolean) {
  return Phi((a - b + (campus ? 2.5 : 0)) / 13.5);
}

export function cleanBracketPicks(seeds: readonly string[], picks: BracketPicks) {
  const clean: BracketPicks = {};
  for (const game of playoffGames) {
    const a = resolveSlot(game.a, seeds, clean);
    const b = resolveSlot(game.b, seeds, clean);
    const pick = picks[game.id];
    if (a && b && (pick === a || pick === b)) clean[game.id] = pick;
  }
  return clean;
}

export function runBracket(
  seeds: readonly string[], ratings: ReadonlyMap<string, number>,
  picks: BracketPicks, draws: number, favorites = false, random = Math.random,
) {
  const totals = Object.fromEntries(seeds.map(id => [id, { semifinal: 0, final: 0, champion: 0 }]));
  const cached = new Map<string, number>();
  let winners: BracketPicks = {};
  for (let index = 0; index < draws; index++) {
    winners = {};
    for (const game of playoffGames) {
      const a = resolveSlot(game.a, seeds, winners);
      const b = resolveSlot(game.b, seeds, winners);
      const key = a + ":" + b + ":" + game.round;
      let chance = cached.get(key);
      if (chance === undefined) {
        chance = matchupChance(ratings.get(a)!, ratings.get(b)!, game.round === 0);
        cached.set(key, chance);
      }
      const lock = picks[game.id];
      const winner = lock === a || lock === b ? lock : (favorites ? chance >= 0.5 : random() < chance) ? a : b;
      winners[game.id] = winner;
      if (game.round === 1) totals[winner].semifinal++;
      if (game.round === 2) totals[winner].final++;
      if (game.round === 3) totals[winner].champion++;
    }
  }
  return { winners, totals };
}
