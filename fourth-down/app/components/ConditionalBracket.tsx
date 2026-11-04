import type { Poll } from "../lib/rankings";

type Seed = { id: string; name: string; seed: number; rank: number; reason: string };

export default function ConditionalBracket({ seeds, poll, teamId }: {
  seeds: Seed[];
  poll: Poll;
  teamId: string;
}) {
  const selected = new Set(seeds.map(team => team.id));
  const firstOut = [...poll.teams].sort((a, b) => a.rank - b.rank)
    .filter(team => !selected.has(team.teamId)).slice(0, 2);
  return <section aria-label="Conditional 12-team playoff bracket">
    <h4>Projected seeds</h4>
    <ul className="outlookField outlookSeedGrid">{seeds.map(team =>
      <li key={team.id} className={team.id === teamId ? "isChosen" : undefined}>
        <b>{team.seed}</b>
        <div><a href={"/team/" + team.id}>{team.name}</a>
          <small>{team.reason}{team.seed <= 4 ? " · Bye" : ""} · Projected rank {team.rank}</small>
        </div>
      </li>)}</ul>
    <h4>First two out under these assumptions</h4>
    <ol>{firstOut.map(team => <li key={team.teamId}><a href={"/team/" + team.teamId}>{team.name}</a> · Projected rank {team.rank}</li>)}</ol>
  </section>;
}
