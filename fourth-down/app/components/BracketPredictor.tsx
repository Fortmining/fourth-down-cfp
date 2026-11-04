"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cleanBracketPicks, matchupChance, playoffGames, resolveSlot, runBracket, type BracketPicks,
} from "../lib/bracket-predictor";

type Team = { id: string; name: string; rank: number };
export type PlayoffSettings = {
  picks: BracketPicks;
  adjustments: Record<string, number>;
};
const draws = 20_000;
const roundNames = ["First round", "Quarterfinals", "Semifinals", "Championship"];

export default function BracketPredictor({ field, order, settings, update }: {
  field: Team[];
  order: Team[];
  settings: PlayoffSettings;
  update: (settings: PlayoffSettings) => void;
}) {
  const seeds = useMemo(() => field.map(team => team.id), [field]);
  const ratings = useMemo(() => new Map(order.map(team =>
    [team.id, 28 - 0.75 * (team.rank - 1) + (settings.adjustments[team.id] ?? 0)],
  )), [order, settings.adjustments]);
  const picks = useMemo(() => cleanBracketPicks(seeds, settings.picks), [seeds, settings.picks]);
  const signature = JSON.stringify([seeds, [...ratings], picks]);
  const [odds, setOdds] = useState<{ key: string; totals: ReturnType<typeof runBracket>["totals"] }>();
  useEffect(() => {
    const [ids, entries, locked] = JSON.parse(signature) as [string[], [string, number][], BracketPicks];
    const timer = window.setTimeout(() => {
      setOdds({ key: signature, totals: runBracket(ids, new Map(entries), locked, draws).totals });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [signature]);
  const visibleOdds = odds?.key === signature ? odds.totals : undefined;
  const percent = (count: number) => (100 * count / draws).toFixed(1) + "%";
  const names = new Map(field.map(team => [team.id, team.name]));

  return <section aria-label="Interactive playoff bracket" className="outlookInteractive">
    <h3>Play the bracket</h3>
    <p>Pick winners or simulate the field. Matchup and title odds are modeled from power ratings, conditional on these seeds and any locked playoff picks.</p>
    <div className="outlookActions">
      <button type="button" onClick={() => update({ ...settings, picks: runBracket(seeds, ratings, {}, 1, true).winners })}>Pick Favorites</button>
      <button type="button" onClick={() => update({ ...settings, picks: runBracket(seeds, ratings, picks, 1).winners })}>Simulate Once</button>
      <button type="button" onClick={() => update({ ...settings, picks: {} })}>Clear Playoff Picks</button>
    </div>
    <div className="outlookRounds">
      {roundNames.map((round, index) => <section key={round} aria-label={round}>
        <h4>{round}</h4>
        {playoffGames.filter(game => game.round === index).map(game => {
          const a = resolveSlot(game.a, seeds, picks);
          const b = resolveSlot(game.b, seeds, picks);
          const chance = a && b ? matchupChance(ratings.get(a)!, ratings.get(b)!, index === 0) : null;
          return <div className="outlookMatch" key={game.id}>
            <small>{game.label}{index === 0 ? " · Campus" : ""}</small>
            {[a, b].map((id, slot) => <button key={slot} type="button" disabled={!a || !b}
              aria-pressed={Boolean(id && picks[game.id] === id)}
              aria-label={id ? `Advance ${names.get(id)} in ${round}` : undefined}
              onClick={() => update({ ...settings, picks: cleanBracketPicks(seeds, { ...picks, [game.id]: picks[game.id] === id ? "" : id }) })}>
              <span>{id ? `${seeds.indexOf(id) + 1}. ${names.get(id)}` : "Winner TBD"}</span>
              {chance !== null && <span>{Math.round((slot === 0 ? chance : 1 - chance) * 100)}%</span>}
            </button>)}
          </div>;
        })}
      </section>)}
    </div>
    <p><strong>National champion</strong> · {names.get(picks.f) ?? "Choose or simulate the final"}</p>
    <h3>Championship odds</h3>
    <p>20,000 playoff simulations · {Object.keys(picks).length} locked picks. These estimates are conditional on making this field.</p>
    {visibleOdds ? <table className="outlookOdds">
      <thead><tr><th scope="col">Team</th><th scope="col">Semifinal</th><th scope="col">Final</th><th scope="col">Champion</th></tr></thead>
      <tbody>{[...field].sort((a, b) => visibleOdds[b.id].champion - visibleOdds[a.id].champion).map(team => {
        const odds = visibleOdds[team.id];
        return <tr key={team.id}><th scope="row">{team.name}</th><td>{percent(odds.semifinal)}</td><td>{percent(odds.final)}</td><td>{percent(odds.champion)}</td></tr>;
      })}</tbody>
    </table> : <p role="status">Calculating championship odds…</p>}
  </section>;
}
