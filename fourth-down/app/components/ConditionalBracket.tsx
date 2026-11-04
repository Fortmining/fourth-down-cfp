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
  const matchup = (seed: number) => {
    const team = seeds.find(row => row.seed === seed)!;
    const source = poll.teams.find(row => row.teamId === team.id);
    return <li className={team.id === teamId ? "isChosen" : undefined}>
      <b>{seed}</b>
      <div><a href={"/team/" + team.id}>{team.name}</a>
        <small>{source?.conference} · {team.reason} · #{team.rank} in {poll.name}</small></div>
    </li>;
  };
  return <section aria-label="Conditional 12-team playoff bracket">
    <div className="outlookBracket">
      {[[1, 8, 9], [4, 5, 12], [2, 7, 10], [3, 6, 11]].map(([bye, host, visitor]) =>
        <article key={bye} className="outlookBracketPath">
          <h4>Quarterfinal path {bye}</h4>
          <p>First round · No. {host} hosts</p>
          <ul className="outlookField">{matchup(host)}{matchup(visitor)}</ul>
          <p>Winner plays the first-round bye team</p>
          <ul className="outlookField">{matchup(bye)}</ul>
        </article>
      )}
    </div>
    <p>Semifinals pair paths 1 and 4, and paths 2 and 3. The semifinal winners meet in the championship.</p>
    <h4>First two out under these assumptions</h4>
    <ol>{firstOut.map(team => <li key={team.teamId}><a href={"/team/" + team.teamId}>{team.name}</a> · #{team.rank} in {poll.name}</li>)}</ol>
  </section>;
}
