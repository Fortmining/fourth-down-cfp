import { standingsTeams } from "./playoff/espn.ts";
import { currentRecordMap } from "./playoff/record-view.ts";
import {
  reconcileSeasonRecords,
  type RecordLedger,
  type ScoreboardGame,
} from "./season-records.ts";
export type StandingsSnapshot = {
  teams: ReturnType<typeof standingsTeams>;
  observedAt: string;
  sourceDate: string | null;
};
export async function fetchTeamStandings(
  season: number,
): Promise<StandingsSnapshot> {
  // The raw standings response exceeds Next's 2 MB fetch-cache limit.
  // Cache its normalized result in cached-current-records, not this oversized body.
  const r = await fetch(
    `https://site.api.espn.com/apis/v2/sports/football/college-football/standings?season=${season}`,
    { cache: "no-store", signal: AbortSignal.timeout(4000) },
  );
  if (!r.ok) throw Error("Standings unavailable");
  const raw = await r.json();
  if (raw.season?.year !== season || !Array.isArray(raw.children))
    throw Error("Invalid standings season");
  const teams = standingsTeams(raw);
  if (!teams.length) throw Error("Empty standings");
  return {
    teams,
    observedAt: new Date().toISOString(),
    sourceDate: r.headers.get("date"),
  };
}
export async function loadCurrentRecords(
  games: ScoreboardGame[],
  season: number | null,
  observedAt: string,
  load: typeof fetchTeamStandings = fetchTeamStandings,
  ledger?: RecordLedger,
) {
  let snapshot: StandingsSnapshot | null = null;
  if (season)
    try {
      snapshot = await load(season);
    } catch {}
  const useLedger = snapshot && ledger && ledger.season === season;
  const currentRecords =
    useLedger && snapshot && ledger
      ? reconcileSeasonRecords(snapshot.teams, ledger, games, observedAt)
      : currentRecordMap(
          snapshot?.teams || [],
          games,
          snapshot?.observedAt || observedAt,
        );
  const conflicting = Object.values(currentRecords).some(
    (r) => r.status === "unavailable",
  );
  return {
    currentRecords,
    recordStatus: useLedger
      ? `Records derived from verified season finals and the current scoreboard; conference championship games are excluded from conference standings.${conflicting ? " Unreconciled totals withheld." : ""}`
      : snapshot
        ? `Current ESPN overall totals; publication records remain separate.${conflicting ? " Conflicting totals withheld pending reconciliation." : ""}`
        : "Standings unavailable; only available scoreboard totals are shown.",
    recordObservedAt: useLedger
      ? observedAt
      : snapshot?.observedAt || observedAt,
    recordLedgerObservedAt: useLedger ? ledger.observedAt : null,
    recordSourceDate: snapshot?.sourceDate || null,
  };
}
