import { NextResponse } from "next/server";
import { collectPolls, defaultPoll } from "./rankings";
import {loadCurrentRecords} from "./cached-current-records";
const BASE =
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
export type SourceFetchTrace = { policy: 'no-store'; requestStartedAt: string; responseReceivedAt?: string; bodyParsedAt?: string; responseDate?: string|null; ageSeconds?: number|null; lastModified?: string|null; etag?: string|null; status?: number; ok: boolean };
async function get(path: string, fresh = false, trace?: SourceFetchTrace) {
  const r = await fetch(`${BASE}/${path}`, {
    ...(fresh ? {cache: 'no-store' as const} : {next: { revalidate: 60 }}),
    signal: AbortSignal.timeout(6000),
  });
  if(trace){trace.responseReceivedAt=new Date().toISOString();trace.status=r.status;trace.responseDate=r.headers?.get('date')??null;const age=r.headers?.get('age');trace.ageSeconds=age!==null&&age!==undefined&&/^\d+$/.test(age)?Number(age):null;trace.lastModified=r.headers?.get('last-modified')?.slice(0,200)??null;trace.etag=r.headers?.get('etag')?.slice(0,200)??null;}
  if (!r.ok) throw new Error("Provider unavailable");
  const value = await r.json();
  if (!value || typeof value !== "object" ||
      (path.startsWith("scoreboard") ? !Array.isArray(value.events) : !Array.isArray(value.rankings))) {
    throw new Error("Invalid provider response");
  }
  if(trace){trace.bodyParsedAt=new Date().toISOString();trace.ok=true;}
  return value;
}
// Only internal dispatch opts in; public requests cannot disable website caching.
export async function loadLiveFeed({forAlerts=false}:{forAlerts?:boolean} = {}) {
  const sourceFetch=forAlerts?{scoreboard:{policy:'no-store',requestStartedAt:new Date().toISOString(),ok:false} as SourceFetchTrace,rankings:{policy:'no-store',requestStartedAt:new Date().toISOString(),ok:false} as SourceFetchTrace}:undefined;
  const [scores, rankings] = await Promise.allSettled([
    get("scoreboard?groups=80&limit=150",forAlerts,sourceFetch?.scoreboard),
    get("rankings",forAlerts,sourceFetch?.rankings),
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
  // The default scoreboard is a week snapshot, even after Saturday ends.
  // Follow ESPN's own calendar across regular/postseason boundaries rather than
  // assuming week + 1 or inventing future dates. Calendar CFP aggregate 999 is
  // omitted because it duplicates the postseason bowl period.
  const schedulePeriods = (s?.leagues?.[0]?.calendar || []).flatMap((period: any) =>
    (period.entries || []).map((entry: any) => ({
      type: Number(period.value), week: Number(entry.value), start: entry.startDate,
    })),
  ).filter((period: any) => Number.isInteger(period.type) &&
    Number.isInteger(period.week) && period.week > 0 && period.week < 999 &&
    Date.parse(period.start) > Date.now()
  ).sort((a: any, b: any) => Date.parse(a.start) - Date.parse(b.start)).slice(0, 2);
  const [previous, ...futureScores] = await Promise.all([
    season && rankingWeek > 1
      ? get(`rankings?seasons=${season}&weeks=${rankingWeek - 1}&types=2`).catch(() => null)
      : Promise.resolve(null),
    ...schedulePeriods.map((period: any) =>
      get(`scoreboard?groups=80&limit=150&seasontype=${period.type}&week=${period.week}&year=${season}`)
        .catch(() => null)),
  ]);
  const pollSources = collectPolls(
    [...polls, ...(previous?.rankings || [])],
    season,
    rankingWeek,
    rankings.status === "rejected",
  );
  const defaultRankingSource = defaultPoll(pollSources);
  const selected = pollSources.find((p) => p.id === defaultRankingSource)!;
  const byId = new Map<string, any>();
  for (const snapshot of futureScores) {
    for (const event of snapshot?.events || []) {
      if (event.id && event.status?.type?.state === "pre" && Date.parse(event.date) > Date.now())
        byId.set(String(event.id), event);
    }
  }
  // The primary feed is authoritative for a duplicate that just went live/final.
  for (const event of s?.events || []) if (event.id) byId.set(String(event.id), event);
  const games = [...byId.values()].map((e: any) => {
    const c = e.competitions?.[0];
    return {
      id: e.id,
      name: e.name,
      date: e.date,
      status: e.status?.type?.state || "pre",
      providerStatus: e.status?.type?.name || null,
      completed: e.status?.type?.completed === true,
      period: Number.isInteger(e.status?.period) ? e.status.period : null,
      clock: typeof e.status?.clock === "number" && Number.isFinite(e.status.clock) ? e.status.clock : null,
      detail: e.status?.type?.shortDetail || "Scheduled",
      kickoffTbd: c?.timeValid === false || /TBD|time.*(?:TBA|to be)/i.test(e.status?.type?.detail || ""),
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
  // Display-only data foundation. Never add this lookup to scheduled push checks.
  const currentRecords=forAlerts?undefined:await loadCurrentRecords(games,season,new Date().toISOString(),s?.season?.type===2?s?.week?.number:undefined);
  const ranked=currentRecords?selected.teams.map(t=>{const current=currentRecords.currentRecords[t.teamId];return {...t,publishedRecord:t.record,record:current?.status==='available'?current.overall:'',recordObservedAt:current?.observedAt??null};}):selected.teams;
  return NextResponse.json(
    {
      updatedAt: new Date().toISOString(),
      ...(sourceFetch?{sourceFetch}:{}),
      ...(currentRecords||{}),
      season,
      week: s?.week?.number || selected?.week || null,
      polls: pollSources,
      defaultRankingSource,
      rankingSource: ranked.length ? selected.name : null,
      rankingDate: selected.date,
      isCommitteeRanking: defaultRankingSource === "cfp",
      rankings: ranked, // Compatibility alias for the independent outlook input.
      outlook: {
        ...(forAlerts?{}:{liveEngineActive:false,recordBasis:"currentRecords; publication records preserved in polls"}),
        inputSource: defaultRankingSource,
        inputDate: selected.date,
        method:
          "Descriptive poll-position tiers; no selection probabilities or automatic-bid predictions",
        teams: ranked,
      },
      games,
      schedulePeriods,
      scheduleComplete: !!s && (schedulePeriods.length > 0 ? futureScores.every(Boolean) : true),
      warnings: [
        ...(futureScores.some((snapshot) => !snapshot)
          ? ["Upcoming schedule is partially unavailable. Some future games may be missing; try refreshing."] : []),
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
      scoreboardAvailable: scores.status === "fulfilled",
    },
    {
      headers: {
        "Cache-Control": forAlerts?'no-store':"public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
