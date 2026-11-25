"use client";

import ConnectedBracket from './ConnectedBracket';
import { useEffect, useMemo, useState } from "react";
import {
  cleanBracketPicks, runBracket, type BracketPicks,
} from "../lib/bracket-predictor";

type RankedTeam = { id: string; name: string; rank: number };
type Team = Omit<RankedTeam,"rank"> & {rank:number|null};
export type PlayoffSettings = {
  picks: BracketPicks;
  adjustments: Record<string, number>;
};
const draws = 20_000;

export default function BracketPredictor({ field, order, settings, update }: {
  field: Team[];
  order: RankedTeam[];
  settings: PlayoffSettings;
  update: (settings: PlayoffSettings) => void;
}) {
  const complete=field.every(t=>t.rank!==null);
  const seeds = useMemo(() => field.map(team => team.id), [field]);
  const ratings = useMemo(() => new Map(order.map(team =>
    [team.id, 28 - 0.75 * (team.rank - 1) + (settings.adjustments[team.id] ?? 0)],
  )), [order, settings.adjustments]);
  const picks = useMemo(() => cleanBracketPicks(seeds, settings.picks), [seeds, settings.picks]);
  const signature = JSON.stringify([seeds, [...ratings], picks]);
  const [odds, setOdds] = useState<{ key: string; totals: ReturnType<typeof runBracket>["totals"] }>();
  useEffect(() => {
    if(!complete)return;
    const [ids, entries, locked] = JSON.parse(signature) as [string[], [string, number][], BracketPicks];
    const timer = window.setTimeout(() => {
      setOdds({ key: signature, totals: runBracket(ids, new Map(entries), locked, draws).totals });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [signature,complete]);
  const visibleOdds = odds?.key === signature ? odds.totals : undefined;
  const percent = (count: number) => (100 * count / draws).toFixed(1) + "%";
  const names = new Map(field.map(team => [team.id, team.name]));

  return <section id="playoff-rounds" aria-label="Interactive playoff bracket" className="outlookInteractive">
    <h3>Tap a team to advance it</h3><a href="#scenario-controls">↑ Change game outcomes & champions</a>
    <p>First-round winners fill the quarterfinals instantly. Continue to the final. Change an earlier pick to clear any dependent winners.</p>
    {!complete&&<p className="outlookUnknown">An automatic qualifier or its seeding is unresolved. Unresolved slots are illustrative; picks explore this layout only. Simulations and odds are unavailable until every team has a ranking anchor.</p>}
    <div className="outlookActions">
      <button type="button" disabled={!complete} onClick={() => update({ ...settings, picks: runBracket(seeds, ratings, {}, 1, true).winners })}>Pick Favorites</button>
      <button type="button" disabled={!complete} onClick={() => update({ ...settings, picks: runBracket(seeds, ratings, picks, 1).winners })}>Simulate Once</button>
      <button type="button" onClick={() => update({ ...settings, picks: {} })}>Clear Playoff Picks</button>
    </div>
    <ConnectedBracket provisional teams={field.map((t,i)=>({...t,seed:i+1,logo:/^\d+$/.test(t.id)?`https://a.espncdn.com/i/teamlogos/ncaa/500/${t.id}.png`:undefined}))} picks={picks} onPick={next=>update({...settings,picks:next})}/>
    <p role="status"><strong>Your champion pick</strong> · {names.get(picks.f) ?? "Pick the earlier rounds, then the final"}</p>
    {complete&&<><h3>Championship odds</h3>
    <p>20,000 playoff simulations · {Object.keys(picks).length} locked picks. These estimates are conditional on making this field.</p>
    {visibleOdds ? <table className="outlookOdds">
      <thead><tr><th scope="col">Team</th><th scope="col">Semifinal</th><th scope="col">Final</th><th scope="col">Champion</th></tr></thead>
      <tbody>{[...field].sort((a, b) => visibleOdds[b.id].champion - visibleOdds[a.id].champion).map(team => {
        const odds = visibleOdds[team.id];
        return <tr key={team.id}><th scope="row">{team.name}</th><td>{percent(odds.semifinal)}</td><td>{percent(odds.final)}</td><td>{percent(odds.champion)}</td></tr>;
      })}</tbody>
    </table> : <p role="status">Calculating championship odds…</p>}</>}
  </section>;
}
