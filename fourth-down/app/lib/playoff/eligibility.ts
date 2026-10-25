import type { TeamSeason } from "./types";
export type EligibilityEvidence = {
  id: string;
  season: number;
  status: "eligible" | "ineligible" | "conditional";
  source: string;
  publishedAt: string | null;
  observedAt: string;
  reason: string;
};
export const eligibilitySources = {
  ncaa2026: "https://web3.ncaa.org/lsdbi/search/proposalView?id=109240",
  ndsu: "https://gobison.com/sports/2026/2/9/fbs-frequently-asked-questions",
  // This February page predates the June rule change. It must not create a ban.
  sacramentoOld:
    "https://hornetsports.com/news/2026/2/16/hornet-football-to-join-the-mac-in-2026.aspx",
};
export function applyEligibility(
  teams: TeamSeason[],
  evidence: EligibilityEvidence[],
  season: number,
  asOf: string,
) {
  const at = Date.parse(asOf),
    issues: string[] = [];
  const result = teams.map((t) => {
    const rows = evidence
      .filter(
        (e) =>
          e.id === t.id &&
          e.season === season &&
          Number.isFinite(Date.parse(e.observedAt)) &&
          (e.publishedAt === null ||
            Number.isFinite(Date.parse(e.publishedAt))) &&
          Date.parse(e.observedAt) <= at &&
          (e.publishedAt === null || Date.parse(e.publishedAt) <= at) &&
          /^https:\/\//.test(e.source),
      )
      .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
    const newest = rows[0];
    const conflicts =
      newest &&
      rows.some(
        (e) => e.observedAt === newest.observedAt && e.status !== newest.status,
      );
    if (conflicts) issues.push("Conflicting eligibility evidence: " + t.id);
    // Membership, six wins, or transition status alone never certifies eligibility.
    return {
      ...t,
      eligible:
        conflicts || !newest || newest.status === "conditional"
          ? null
          : newest.status === "eligible",
    };
  });
  return {
    teams: result,
    unresolved: result.filter((t) => t.eligible === null).map((t) => t.id),
    issues,
  };
}
