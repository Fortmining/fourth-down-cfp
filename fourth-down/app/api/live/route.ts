import { NextResponse } from "next/server";
import { collectPolls, defaultPoll } from "../../lib/rankings";
export const dynamic = "force-dynamic";
const BASE =
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
async function get(path: string) {
  const r = await fetch(`${BASE}/${path}`, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error("Provider unavailable");
  const value = await r.json();
  if (!value || typeof value !== "object" ||
      (path.startsWith("scoreboard") ? !Array.isArray(value.events) : !Array.isArray(value.rankings))) {
    throw new Error("Invalid provider response");
  }
  return value;
}
export async function GET() {
  const [scores, rankings] = await Promise.allSettled([
    get("scoreboard?groups=80&limit=150"),
    get("rankings"),
  ]);
  if (scores.status === "rejected" && rankings.status === "rejected")
    return NextResponse.json(
      {
        error:
          "The score and ranking feeds are temporarily unavailable. Please try again.",
      },
      { status: 503 },
    );
  const s = scores.status === "fulfilled" ? scores.value : null;
  const polls =
    rankings.status === "fulfilled" ? rankings.value.rankings || [] : [];
  const season = s?.season?.year || polls[0]?.season?.year || null;
  const rankingWeek =
    rankings.status === "fulfilled"
      ? rankings.value.latestWeek?.number ||
        Math.max(0, ...polls.map((p: any) => p.occurrence?.number || 0))
      : s?.week?.number || null;
  // ESPN can return only polls released in the requested week. Retrieve the preceding
  // edition as well, so a Sunday release never erases another source's latest poll.
  const previous =
    season && rankingWeek > 1
      ? await get(
          `rankings?seasons=${season}&weeks=${rankingWeek - 1}&types=2`,
        ).catch(() => null)
      : null;
  const pollSources = collectPolls(
    [...polls, ...(previous?.rankings || [])],
    season,
    rankingWeek,
    rankings.status === "rejected",
  );
  const defaultRankingSource = defaultPoll(pollSources);
  const selected = pollSources.find((p) => p.id === defaultRankingSource)!;
  const games = (s?.events || []).map((e: any) => {
    const c = e.competitions?.[0];
    return {
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.state || "pre",
      detail: e.status?.type?.shortDetail || "Scheduled",
      broadcast:
        c?.broadcasts?.flatMap((b: any) => b.names || []).join(" · ") || "",
      teams: (c?.competitors || []).map((t: any) => ({
        id: String(t.team?.id),
        name:
          t.team?.displayName ||
          [t.team?.location, t.team?.name].filter(Boolean).join(" "),
        logo: t.team?.logo,
        score: t.score,
        homeAway: t.homeAway,
        winner: t.winner,
        rank: t.curatedRank?.current <= 25 ? t.curatedRank.current : null,
        record: t.records?.find((r: any) => r.type === "total")?.summary || "",
      })),
    };
  });
  const ranked = selected.teams;
  return NextResponse.json(
    {
      updatedAt: new Date().toISOString(),
      season,
      week: s?.week?.number || selected?.week || null,
      polls: pollSources,
      defaultRankingSource,
      rankingSource: ranked.length ? selected.name : null,
      rankingDate: selected.date,
      isCommitteeRanking: defaultRankingSource === "cfp",
      rankings: ranked, // Compatibility alias for the independent outlook input.
      outlook: {
        inputSource: defaultRankingSource,
        inputDate: selected.date,
        method:
          "Descriptive poll-position tiers; no selection probabilities or automatic-bid predictions",
        teams: ranked,
      },
      games,
      warnings: [
        ...(rankings.status === "rejected" ? ["Ranking feed is temporarily unavailable; any preceding editions retain their original publication dates."] : []),
        ...(scores.status === "rejected"
          ? ["Scores are temporarily unavailable."]
          : []),
        ...(!ranked.length
          ? [
              `${selected.name} is unavailable for the outlook. No other poll is substituted.`,
            ]
          : []),
      ],
      provider: "ESPN",
      scoreboardDate: s?.day?.date || null,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
