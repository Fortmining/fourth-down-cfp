import { unstable_cache } from "next/cache";
import {
  fetchTeamStandings,
  loadCurrentRecords as joinCurrentRecords,
} from "./current-records";
import { fetchRecordLedger } from "./season-records";
// Keys include the season argument. Store only normalized rows and observation metadata.
const cachedStandings = unstable_cache(
  fetchTeamStandings,
  ["fd-current-records-v1"],
  { revalidate: 60 },
);
const cachedLedger = unstable_cache(
  fetchRecordLedger,
  ["fd-record-ledger-v1"],
  { revalidate: 900 },
);
export async function loadCurrentRecords(
  games: Parameters<typeof joinCurrentRecords>[0],
  season: number | null,
  observedAt: string,
  currentWeek?: number,
) {
  const [snapshot, ledger] = await Promise.all([
    season ? cachedStandings(season).catch(() => undefined) : undefined,
    season && currentWeek && currentWeek >= 1 && currentWeek <= 21
      ? cachedLedger(season, currentWeek - 1).catch(() => undefined)
      : undefined,
  ]);
  const result = await joinCurrentRecords(
    games,
    season,
    ledger ? new Date().toISOString() : observedAt,
    async () => {
      if (!snapshot) throw Error("Standings unavailable");
      return snapshot;
    },
    ledger,
  );
  if (!ledger)
    result.recordStatus +=
      " Verified season ledger unavailable; no ledger-derived correction is asserted.";
  return result;
}
