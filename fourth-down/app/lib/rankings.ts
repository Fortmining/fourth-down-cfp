import type { Ranked } from "./model";
export const sources = [
  {
    id: "ap",
    name: "AP Top 25",
    url: "https://apnews.com/hub/ap-top-25-college-football-poll",
  },
  {
    id: "coaches",
    name: "AFCA Coaches Poll",
    url: "https://www.afca.com/polls/",
  },
  {
    id: "cfp",
    name: "CFP committee rankings",
    url: "https://collegefootballplayoff.com/sports/2016/10/11/about-rankings",
  },
] as const;
export type SourceId = (typeof sources)[number]["id"];
export type Poll = {
  id: SourceId;
  name: string;
  url: string;
  status: "available" | "awaiting_update" | "not_published" | "unavailable";
  date: string | null;
  week: number | null;
  season: number | null;
  teams: Ranked[];
  message: string;
};
function identify(p: any): SourceId | undefined {
  if (p.type === "ap" || /^(AP Top 25|Associated Press)/i.test(p.name || ""))
    return "ap";
  if (
    p.type === "cfp" ||
    /college football playoff|CFP|playoff rankings/i.test(p.name || "")
  )
    return "cfp";
  if (
    p.type === "usa" ||
    /^(AFCA Coaches Poll|USA Today Coaches Poll|Coaches Poll)$/i.test(
      p.name || "",
    )
  )
    return "coaches";
}
export function collectPolls(
  raw: any[],
  season: number | null,
  week: number | null,
  failed: boolean,
  now = new Date(),
): Poll[] {
  return sources.map((source) => {
    const candidates = raw.filter(
      (p) =>
        identify(p) === source.id &&
        p.season?.year === season &&
        p.ranks?.length,
    );
    const p = candidates.sort(
      (a, b) =>
        Date.parse(b.date || "") - Date.parse(a.date || "") ||
        Number(b.occurrence?.number || 0) - Number(a.occurrence?.number || 0),
    )[0];
    const teams: Ranked[] = (p?.ranks || [])
      .filter((r: any) => r.current >= 1 && r.current <= 25 && r.team?.id)
      .map((r: any) => ({
        rank: r.current,
        previous: r.previous || null,
        teamId: String(r.team.id),
        name:
          r.team.displayName ||
          [r.team.location, r.team.name].filter(Boolean).join(" "),
        logo: r.team.logos?.[0]?.href || r.team.logo,
        record: r.recordSummary || r.record || "",
        conference: r.team.groups?.shortName || "Conference unavailable",
      }))
      .sort((a: Ranked, b: Ranked) => a.rank - b.rank);
    const pollWeek = p?.occurrence?.number || null;
    // Only claim “not published” when the announced 2026 first release is still ahead.
    const beforeFirst =
      source.id === "cfp" &&
      season === 2026 &&
      now.getTime() < Date.parse("2026-11-03T00:00:00-05:00");
    const status: Poll["status"] = !teams.length
      ? beforeFirst
        ? "not_published"
        : "unavailable"
      : week && pollWeek && pollWeek < week
        ? "awaiting_update"
        : "available";
    return {
      ...source,
      status,
      date: p?.date || null,
      week: pollWeek,
      season: p?.season?.year || null,
      teams,
      message:
        status === "not_published"
          ? "The first 2026 CFP rankings are scheduled for November 3."
          : status === "unavailable"
            ? failed
              ? "Ranking feed temporarily unavailable. No other poll is substituted."
              : "No current-season edition is available from the provider. Publication is unconfirmed; no other poll is substituted."
            : status === "awaiting_update"
              ? `Latest available: Week ${pollWeek}. No Week ${week} edition returned by the provider.`
              : `Latest available${pollWeek ? `: Week ${pollWeek}` : ""}.`,
    };
  });
}
export function defaultPoll(polls: Poll[]): SourceId {
  return polls.some((p) => p.id === "cfp" && p.teams.length) ? "cfp" : "ap";
}
export function comparisonRows(polls: Poll[]) {
  const teams = new Map<string, Ranked>();
  for (const p of polls)
    for (const t of p.teams) if (!teams.has(t.teamId)) teams.set(t.teamId, t);
  return [...teams.values()]
    .map((t) => {
      const ranks = Object.fromEntries(
        polls.map((p) => [
          p.id,
          p.teams.find((r) => r.teamId === t.teamId)?.rank ?? null,
        ]),
      ) as Record<SourceId, number | null>;
      const values = Object.values(ranks).filter(
        (r): r is number => r !== null,
      );
      return {
        team: t,
        ranks,
        spread:
          values.length >= 2 ? Math.max(...values) - Math.min(...values) : null,
      };
    })
    .sort(
      (a, b) =>
        Math.min(...Object.values(a.ranks).map((r) => r ?? 99)) -
          Math.min(...Object.values(b.ranks).map((r) => r ?? 99)) ||
        a.team.name.localeCompare(b.team.name),
    );
}
