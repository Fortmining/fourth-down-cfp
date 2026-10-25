import { unstable_cache } from "next/cache";
import {
  fetchTeamStandings,
  loadCurrentRecords as joinCurrentRecords,
} from "./current-records";
// Keys include the season argument. Store only normalized rows and observation metadata.
const cachedStandings = unstable_cache(
  fetchTeamStandings,
  ["fd-current-records-v1"],
  { revalidate: 60 },
);
export async function loadCurrentRecords(
  games: Parameters<typeof joinCurrentRecords>[0],
  season: number | null,
  observedAt: string,
) {
  return joinCurrentRecords(games, season, observedAt, cachedStandings);
}
