import type { Edition, GameRevision, TeamSeason } from "./types";
import { isPac12FlexGame } from "./schedule.ts";
export function standingsTeams(raw: any): TeamSeason[] {
  const rows = new Map<string, TeamSeason>();
  function walk(node: any, conference: string) {
    const conf = conference;
    for (const e of node.standings?.entries || []) {
      const stats = e.stats || [];
      rows.set(String(e.team.id), {
        id: String(e.team.id),
        name: e.team.displayName,
        conference,
        eligible: null,
        reportedRecord: stats.find((s: any) => s.name === "overall")
          ?.displayValue,
        reportedConferenceRecord: stats.find((s: any) => s.name === "vs. Conf.")
          ?.displayValue,
      });
    }
    for (const child of node.children || []) walk(child, conf);
  }
  for (const child of raw.children || []) walk(child, String(child.id));
  return [...rows.values()].sort((a, b) => Number(a.id) - Number(b.id));
}
export function gameFromEspn(
  e: any,
  season: number,
  observedAt: string,
  source: string,
  teams: TeamSeason[],
): GameRevision | null {
  const c = e.competitions?.[0],
    competitors = c?.competitors;
  if (
    !/^\d+$/.test(String(e.id)) ||
    competitors?.length !== 2 ||
    !Number.isFinite(Date.parse(e.date))
  )
    return null;
  const status = e.status || c.status;
  const state = status?.type?.state;
  if (!["pre", "in", "post"].includes(state)) return null;
  const ids = competitors.map((x: any) => String(x.team.id)) as [
    string,
    string,
  ];
  if (ids[0] === ids[1] || ids.some((id) => !/^[1-9]\d{0,11}$/.test(id)))
    return null;
  const a = teams.find((x) => x.id === ids[0]),
    b = teams.find((x) => x.id === ids[1]);
  const scores = competitors.map((x: any) => {
    const v = typeof x.score === "object" ? x.score?.value : x.score;
    return v !== "" &&
      v !== null &&
      v !== undefined &&
      Number.isInteger(Number(v)) &&
      Number(v) >= 0
      ? Number(v)
      : null;
  }) as [number | null, number | null];
  const winner = competitors.filter((x: any) => x.winner === true);
  return {
    id: String(e.id),
    season,
    date: e.date,
    state,
    completed: status.type.completed === true,
    teams: ids,
    scores,
    winner: winner.length === 1 ? String(winner[0].team.id) : null,
    conferenceGame:
      !!a &&
      !!b &&
      a.conference !== "18" &&
      a.conference === b.conference &&
      !isPac12FlexGame(
        season,
        e.date,
        a.conference,
        b.conference,
        String(e.id),
      ),
    period: Number.isInteger(status.period) ? status.period : null,
    clock:
      typeof status.clock === "number" && Number.isFinite(status.clock)
        ? status.clock
        : null,
    observedAt,
    source,
  };
}
export function editionsFromEspn(
  raw: any,
  season: number,
  asOf: string,
): Edition[] {
  return (raw.rankings || []).flatMap((p: any) => {
    const id =
      p.type === "ap"
        ? "ap"
        : p.type === "usa"
          ? "coaches"
          : p.type === "cfp"
            ? "cfp"
            : null;
    if (
      !id ||
      p.season?.year !== season ||
      !Number.isFinite(Date.parse(p.date)) ||
      Date.parse(p.date) > Date.parse(asOf)
    )
      return [];
    return [
      {
        id,
        date: p.date,
        season,
        ranks: p.ranks.map((r: any) => ({
          id: String(r.team.id),
          rank: r.current,
          previous: r.previous || null,
          record: r.recordSummary || "",
        })),
      },
    ];
  });
}
