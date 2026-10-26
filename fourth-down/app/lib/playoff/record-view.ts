export type CurrentRecord = {
  overall: string;
  conference: string | null;
  observedAt: string;
  source: "ESPN standings" | "ESPN scoreboard" | "ESPN verified game ledger";
  status: "available" | "unavailable";
};
// Display join never alters an official edition or its publication-time record.
export function displayRecord(
  teamId: string,
  current: Record<string, CurrentRecord> | undefined,
) {
  const row = current?.[teamId];
  return row?.status === "available" ? row.overall : "";
}
export function currentRecordMap(
  standings: {
    id: string;
    reportedRecord?: string;
    reportedConferenceRecord?: string;
  }[],
  games: {
    date: string;
    teams: {
      id: string;
      record?: string;
    }[];
  }[],
  observedAt: string,
): Record<string, CurrentRecord> {
  const result: Record<string, CurrentRecord> = {};
  const played = (r: string) =>
    r
      .split("-")
      .map(Number)
      .reduce((a, b) => a + b, 0);
  const valid = (v: unknown): v is string =>
    typeof v === "string" && /^\d{1,2}-\d{1,2}(?:-\d{1,2})?$/.test(v);
  for (const g of [...games].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  ))
    for (const t of g.teams)
      if (
        valid(t.record) &&
        (!result[t.id] || played(t.record) >= played(result[t.id].overall))
      )
        result[t.id] = {
          overall: t.record,
          conference: null,
          observedAt,
          source: "ESPN scoreboard",
          status: "available",
        };
  for (const t of standings)
    if (valid(t.reportedRecord)) {
      const prior = result[t.id];
      const conflict =
        !!prior &&
        (played(t.reportedRecord) < played(prior.overall) ||
          (played(t.reportedRecord) === played(prior.overall) &&
            t.reportedRecord !== prior.overall));
      result[t.id] = {
        overall: t.reportedRecord,
        conference: valid(t.reportedConferenceRecord)
          ? t.reportedConferenceRecord
          : null,
        observedAt,
        source: "ESPN standings",
        status: conflict ? "unavailable" : "available",
      };
    }
  return result;
}
