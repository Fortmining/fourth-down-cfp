import type { Inputs } from "./types";
export const PAC12_FLEX_SOURCE =
  "https://pac-12.com/news/2026/6/30/general-the-new-pac-12-conference-officially-launches-with-the-addition-of-seven-full-time-members.aspx";
export const PAC12_RULE_SOURCE =
  "https://pac-12.com/news/2026/9/3/pac-12-announces-commercial-and-operational-updates-ahead-of-its-2026-football-season-kickoff.aspx";
// Provider event identity + provider championship note, not a guessed opponent.
export const championshipSlots: Record<
  string,
  { conference: string; label: string }
> = {
  "401869535": { conference: "12", label: "Conference USA" },
  "401869546": { conference: "37", label: "Sun Belt" },
  "401869533": { conference: "4", label: "Big 12" },
  "401869542": { conference: "9", label: "Pac-12" },
  "401874049": { conference: "17", label: "Mountain West" },
  "401858318": { conference: "1", label: "ACC" },
  "401869536": { conference: "15", label: "MAC" },
  "401869545": { conference: "8", label: "SEC" },
  "401869532": { conference: "151", label: "American" },
  "401869534": { conference: "5", label: "Big Ten" },
};
const flexHosts: Record<string, string> = {
  "401860926": "36",
  "401860927": "278",
  "401860928": "328",
  "401860929": "265",
};
export function scheduleAudit(input: Inputs) {
  const pending = (input.pendingGames || []).map((p) => {
    const title = input.season === 2026 && championshipSlots[p.id];
    const flex = input.season === 2026 && flexHosts[p.id];
    if (title)
      return {
        ...p,
        kind: "championship-slot",
        conference: title.conference,
        label: title.label,
        opponentsFinal: false,
        reason: "Participants earned through conference competition",
        source: p.source,
      };
    if (
      flex &&
      p.knownTeamIds.includes(flex) &&
      p.date.startsWith("2026-11-28")
    )
      return {
        ...p,
        kind: "flex-slot",
        conference: "9",
        opponentsFinal: false,
        conferenceCompetition: false,
        source: PAC12_FLEX_SOURCE,
        reason: "Official matchup assignment pending; do not infer rematch",
      };
    return {
      ...p,
      kind: "unclassified",
      conference: null,
      opponentsFinal: false,
      reason: "Source confirmation required",
    };
  });
  const affected = new Set(
    pending.flatMap((p) =>
      p.kind === "flex-slot"
        ? input.teams.filter((t) => t.conference === "9").map((t) => t.id)
        : p.kind === "unclassified"
          ? p.knownTeamIds.length
            ? p.knownTeamIds
            : input.teams.map((t) => t.id)
          : [],
    ),
  );
  return {
    pending,
    unclassified: pending.filter((p) => p.kind === "unclassified").length,
    teamCoverage: input.teams.map((t) => ({
      id: t.id,
      regularOpponentsComplete: input.coverage.complete && !affected.has(t.id),
      championshipOpponentContingent: !!pending.find(
        (p) => p.kind === "championship-slot" && p.conference === t.conference,
      ),
      knownRemainingGameIds: input.games
        .filter((g) => g.state === "pre" && g.teams.includes(t.id))
        .map((g) => g.id),
    })),
    // A championship slot is not a missing regular-season opponent for every team.
    regularSeasonComplete: input.coverage.complete && affected.size === 0,
    allOpponentsAssigned: pending.length === 0,
  };
}

/** Pac-12's Week 13 is explicitly non-conference, even with two Pac-12 teams. */
export function isPac12FlexGame(
  season: number,
  date: string,
  aConference?: string,
  bConference?: string,
  id?: string,
) {
  const at = Date.parse(date);
  return (
    season === 2026 &&
    aConference === "9" &&
    bConference === "9" &&
    (!!flexHosts[id || ""] ||
      (at >= Date.parse("2026-11-28T08:00:00Z") &&
        at < Date.parse("2026-11-29T08:00:00Z")))
  );
}
