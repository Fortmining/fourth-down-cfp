import { gameFromEspn } from "./playoff/espn.ts";
import { currentRecords, mergeLedger, validFinal } from "./playoff/ledger.ts";
import { championshipSlots } from "./playoff/schedule.ts";
import type { GameRevision, TeamSeason } from "./playoff/types";
import type { CurrentRecord } from "./playoff/record-view";

export type RecordLedger = {
  season: number;
  throughWeek: number;
  games: GameRevision[];
  observedAt: string;
};
export type ScoreboardGame = {
  id?: string;
  date: string;
  status?: string;
  completed?: boolean;
  teams: { id: string; record?: string; score?: unknown; winner?: boolean }[];
};

/** Explicit weeks avoid ESPN's date-range endpoint, which can return a partial season. */
export async function fetchRecordLedger(
  season: number,
  throughWeek: number,
): Promise<RecordLedger> {
  if (
    !Number.isInteger(season) ||
    season < 2020 ||
    !Number.isInteger(throughWeek) ||
    throughWeek < 0 ||
    throughWeek > 20
  )
    throw Error("Invalid record-ledger season/week");
  const games: GameRevision[] = [];
  const signal = AbortSignal.timeout(5000);
  // Limit concurrency; the cache stores only normalized facts, never oversized bodies.
  for (let first = 1; first <= throughWeek; first += 3) {
    const batches = await Promise.all(
      Array.from(
        { length: Math.min(3, throughWeek - first + 1) },
        async (_, n) => {
          const week = first + n;
          const source = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=300&seasontype=2&week=${week}&year=${season}`;
          const response = await fetch(source, { cache: "no-store", signal });
          if (!response.ok) throw Error("Season record source unavailable");
          const raw = await response.json();
          if (
            raw.season?.year !== season ||
            Number(raw.week?.number) !== week ||
            !Array.isArray(raw.events) ||
            !raw.events.length ||
            raw.events.length >= 300
          )
            throw Error("Incomplete/wrong-season record source");
          const observedAt = new Date().toISOString();
          return raw.events.flatMap((e: any) => {
            if (e.status?.type?.state !== "post") return [];
            const g = gameFromEspn(e, season, observedAt, source, []);
            if (!g || !validFinal(g, Date.parse(observedAt)))
              throw Error("Unverified season final");
            // Membership is joined later; preserve the provider's explicit competition flag.
            return [
              {
                ...g,
                conferenceGame:
                  e.competitions?.[0]?.conferenceCompetition === true,
              },
            ];
          });
        },
      ),
    );
    games.push(...batches.flat());
  }
  return {
    season,
    throughWeek,
    games: mergeLedger([], games),
    observedAt: new Date().toISOString(),
  };
}

export function reconcileSeasonRecords(
  teams: TeamSeason[],
  ledger: RecordLedger,
  current: ScoreboardGame[],
  observedAt: string,
): Record<string, CurrentRecord> {
  const now = Date.parse(observedAt);
  if (
    !Number.isFinite(now) ||
    Date.parse(ledger.observedAt) > now ||
    !Number.isFinite(Date.parse(ledger.observedAt))
  )
    throw Error("Invalid record observation epoch");
  const incoming = current.flatMap((g) => {
    if (!g.id || !g.status) return [];
    const raw = {
      id: g.id,
      date: g.date,
      status: { type: { state: g.status, completed: g.completed } },
      competitions: [
        {
          competitors: g.teams.map((t) => ({
            team: { id: t.id },
            score: t.score,
            winner: t.winner,
          })),
        },
      ],
    };
    const revision = gameFromEspn(
      raw,
      ledger.season,
      observedAt,
      "ESPN current scoreboard",
      teams,
    );
    return revision ? [revision] : [];
  });
  const games = mergeLedger(ledger.games, incoming).map((g) => ({
    ...g,
    conferenceGame:
      !(ledger.season === 2026 && championshipSlots[g.id]) && g.conferenceGame,
  }));
  const records = currentRecords({
    season: ledger.season,
    observedAt,
    teams,
    games,
    editions: [],
    coverage: { complete: true, issues: [] },
    rulesVersion: "historical-resume-no-qualification-v1",
  });
  const count = (r: string | undefined) =>
    r && /^\d+-\d+(?:-\d+)?$/.test(r)
      ? r.split("-").reduce((n, v) => n + Number(v), 0)
      : null;
  return Object.fromEntries(
    teams.map((t) => {
      const r = records[t.id],
        reported = count(t.reportedRecord),
        conf = count(t.reportedConferenceRecord);
      const available =
        (r.games > 0 || t.reportedRecord === "0-0") &&
        (reported === null ||
          r.games > reported ||
          r.overall === t.reportedRecord);
      const conferenceAvailable =
        available &&
        (conf === null ||
          count(r.conference)! > conf ||
          r.conference === t.reportedConferenceRecord);
      return [
        t.id,
        {
          overall: r.overall,
          conference: conferenceAvailable ? r.conference : null,
          observedAt,
          source: "ESPN verified game ledger" as const,
          status: available ? ("available" as const) : ("unavailable" as const),
        },
      ];
    }),
  );
}
