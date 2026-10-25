import { standingsTeams } from "./playoff/espn.ts";
import { currentRecordMap } from "./playoff/record-view.ts";
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
  games: { date: string; teams: { id: string; record?: string }[] }[],
  season: number | null,
  observedAt: string,
  load: typeof fetchTeamStandings = fetchTeamStandings,
) {
  let snapshot: StandingsSnapshot | null = null;
  if (season)
    try {
      snapshot = await load(season);
    } catch {}
  const currentRecords = currentRecordMap(
    snapshot?.teams || [],
    games,
    snapshot?.observedAt || observedAt,
  );
  const conflicting = Object.values(currentRecords).some(
    (r) => r.status === "unavailable",
  );
  return {
    currentRecords,
    recordStatus: snapshot
      ? `Current ESPN overall totals; publication records remain separate.${conflicting ? " Conflicting totals withheld pending reconciliation." : ""}`
      : "Standings unavailable; only available scoreboard totals are shown.",
    recordObservedAt: snapshot?.observedAt || observedAt,
    recordSourceDate: snapshot?.sourceDate || null,
  };
}
