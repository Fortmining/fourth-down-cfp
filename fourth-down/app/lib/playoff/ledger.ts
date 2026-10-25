import type { GameRevision, Inputs, RecordRow } from "./types";
export function validFinal(g: GameRevision, now = Infinity) {
  return (
    g.state === "post" &&
    g.completed &&
    Number.isFinite(Date.parse(g.observedAt)) &&
    Date.parse(g.observedAt) <= now + 30000 &&
    Date.parse(g.date) <= now &&
    g.scores.every((x) => Number.isInteger(x) && x! >= 0) &&
    g.scores[0] !== g.scores[1] &&
    g.winner === g.teams[g.scores[0]! > g.scores[1]! ? 0 : 1]
  );
}
// New observations revise event identity; never add an extra game for a correction.
export function mergeLedger(prior: GameRevision[], incoming: GameRevision[]) {
  const m = new Map(prior.map((g) => [`${g.season}:${g.id}`, g]));
  for (const g of incoming) {
    const key = `${g.season}:${g.id}`,
      old = m.get(key);
    if (!old || Date.parse(g.observedAt) >= Date.parse(old.observedAt))
      m.set(key, g);
  }
  return [...m.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
}
export function currentRecords(input: Inputs): Record<string, RecordRow> {
  const rows: Record<string, RecordRow> = {};
  for (const t of input.teams) {
    let wins = 0,
      losses = 0,
      cw = 0,
      cl = 0;
    const gameIds: string[] = [];
    for (const g of mergeLedger([], input.games)) {
      if (
        g.season !== input.season ||
        !g.teams.includes(t.id) ||
        !validFinal(g, Date.parse(input.observedAt))
      )
        continue;
      gameIds.push(g.id);
      const win = g.winner === t.id;
      if (win) wins++;
      else losses++;
      if (g.conferenceGame) {
        if (win) cw++;
        else cl++;
      }
    }
    const overall = `${wins}-${losses}`,
      conference = `${cw}-${cl}`;
    rows[t.id] = {
      overall,
      conference,
      wins,
      losses,
      ties: 0,
      games: gameIds.length,
      gameIds,
      reported: t.reportedRecord,
      status: t.reportedRecord
        ? t.reportedRecord === overall &&
          (!t.reportedConferenceRecord ||
            t.reportedConferenceRecord === conference)
          ? "reconciled"
          : "conflict"
        : "derived",
    };
  }
  return rows;
}
