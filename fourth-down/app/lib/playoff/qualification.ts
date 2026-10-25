import type { ModelRow, TeamSeason } from "./types";
export const powerFour = ["1", "4", "5", "8"];
export const groupSix = ["151", "12", "15", "17", "9", "37"];
export function allocateShadowField(
  rows: ModelRow[],
  teams: TeamSeason[],
  champions: Record<string, string>,
  adaptersVerified = false,
) {
  const issues: string[] = [];
  if (!adaptersVerified)
    issues.push("Conference championship/tiebreaker adapters unverified");
  if (teams.some((t) => t.eligible === null))
    issues.push("Eligibility unresolved");
  const eligible = rows
    .filter((r) => teams.find((t) => t.id === r.id)?.eligible === true)
    .map((r, i) => ({ ...r, position: i + 1 }));
  const aq: string[] = [];
  for (const conference of powerFour) {
    const id = champions[conference];
    if (
      !id ||
      !eligible.some((r) => r.id === id) ||
      teams.find((t) => t.id === id)?.conference !== conference
    )
      issues.push(`Unresolved champion: ${conference}`);
    else aq.push(id);
  }
  const six = eligible.find((r) =>
    groupSix.includes(teams.find((t) => t.id === r.id)!.conference),
  );
  if (!six) issues.push("Six-conference representative unresolved");
  else aq.push(six.id);
  const nd = eligible.find((r) => r.id === "87"),
    protectedND = !!nd && nd.position <= 12;
  const selected = new Set([...aq, ...(protectedND ? ["87"] : [])]);
  for (const r of eligible) {
    if (selected.size >= 12) break;
    selected.add(r.id);
  }
  if (selected.size !== 12) issues.push("Insufficient eligible field");
  return {
    shadow: true,
    definitive: false,
    issues,
    field: issues.length
      ? []
      : eligible
          .filter((r) => selected.has(r.id))
          .map((r, i) => ({
            id: r.id,
            selectionPosition: r.position,
            seed: i + 1,
            reason: aq.includes(r.id)
              ? "projected automatic qualifier"
              : r.id === "87" && protectedND
                ? "projected Notre Dame top-12 protection"
                : "projected at-large",
            bye: i < 4,
            firstRoundOpponentSeed: i < 4 ? null : 17 - (i + 1),
          })),
  };
}
