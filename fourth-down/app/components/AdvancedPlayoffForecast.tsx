import data from "../lib/playoff/advanced-forecast.json";

type Forecast = {
  asOf: string;
  draws: number;
  teams: Record<string, { seeds: number[]; firstTwoOut: number }>;
};

const forecast = data as Forecast | null;

export default function AdvancedPlayoffForecast({ teamId, name }: { teamId: string; name: string }) {
  if (!forecast || !Object.hasOwn(forecast.teams, teamId)) return null;
  const team = forecast.teams[teamId];
  const selected = team.seeds.reduce((sum, count) => sum + count, 0);
  const percent = (count: number) => `${(100 * count / forecast.draws).toFixed(1)}%`;
  return <section aria-label="Baseline playoff qualification forecast">
    <h3>{name} playoff forecast</h3>
    <p><strong>{percent(selected)}</strong> qualify · <strong>{percent(team.firstTwoOut)}</strong> finish among the first two teams out.</p>
    <p>{forecast.draws.toLocaleString()} modeled seasons using the {forecast.asOf.slice(0, 10)} snapshot. Your What If picks do not change this baseline. Championship odds below use your selected bracket.</p>
    <details><summary>Seed distribution and assumptions</summary>
      <ol>{team.seeds.map((count, index) => <li key={index}>Seed {index + 1} · {percent(count)} of all draws</li>)}</ol>
      <p>Simulated regular-season and Power Four championship results adjust the AP starting order. Conference tiebreakers use modeled substitutes for unavailable proprietary metrics, including mixed-schedule ACC comparisons. Pac-12 flex opponents are scenario assumptions. The other six title games are not simulated.</p>
    </details>
  </section>;
}
