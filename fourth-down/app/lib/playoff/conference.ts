import { mergeLedger, validFinal } from "./ledger.ts";
import { championshipSlots, isPac12FlexGame } from "./schedule.ts";
import type { Inputs } from "./types";

export const ruleSources = {
  cfp: "https://collegefootballplayoff.com/sports/2024/5/29/12-team-format",
  acc: "https://s3.amazonaws.com/sidearm.sites/acc.sidearmsports.com/documents/2026/7/15/ACC_Football_Tiebreaker_Policy_Jully_2026.pdf",
  big12:
    "https://s3.amazonaws.com/big12sports.com/documents/2025/11/4/Big_12_Football_2024_Tiebreaker_Policy.pdf",
  sec: "https://storage.googleapis.com/secsports-prod/upload/2024/10/29/f6fc7cd9-3031-4357-8754-80bfa4b9c4c0.pdf",
  bigten:
    "https://nextgen.bigten.org/api/media/file/f142aa7f-aa37-430b-bf09-8988a6952c0c-2024_Big_Ten_Football_Tiebreaker_-_FINAL_10__72_.pdf",
};
export type ConferencePolicy =
  | "acc-2026"
  | "big12-current"
  | "sec-current"
  | "bigten-2026-top-records"
  | "bigten-2024-carry-forward";
type ExternalEvidence = {
  asOf: string;
  source: string;
  metric: "team-success" | "team-rating" | "capped-relative-margin";
  direction: "higher" | "lower";
  values: Record<string, number>;
};
type Options = {
  regularSeasonComplete: boolean;
  external?: ExternalEvidence;
  eligibleWins?: Record<string, number>;
};

/** Terminal qualification only. Midseason standing is not a championship berth. */
export function resolveConference(
  input: Inputs,
  conference: string,
  policy: ConferencePolicy,
  options: Options,
) {
  const trace: { step: string; ids: string[] }[] = [];
  const issues: string[] = [];
  const expected = {
    "acc-2026": "1",
    "big12-current": "4",
    "sec-current": "8",
    "bigten-2026-top-records": "5",
    "bigten-2024-carry-forward": "5",
  }[policy];
  if (conference !== expected) throw Error("Conference/policy mismatch");
  if (input.season !== 2026) issues.push("Adapter is scoped to 2026");
  if (policy === "bigten-2024-carry-forward")
    issues.push("Full Big Ten policy not independently reissued for 2026");
  if (!options.regularSeasonComplete || !input.coverage.complete)
    issues.push("Regular season not confirmed complete");
  const members = input.teams.filter((t) => t.conference === conference);
  if (members.some((t) => t.eligible === null))
    issues.push("Postseason eligibility unresolved");
  const finals = mergeLedger([], input.games).filter(
    (g) =>
      g.season === input.season &&
      g.conferenceGame &&
      validFinal(g, Date.parse(input.observedAt)) &&
      !(input.season === 2026 && championshipSlots[g.id]) &&
      !isPac12FlexGame(g.season, g.date, conference, conference, g.id),
  );
  const games = (id: string) => finals.filter((g) => g.teams.includes(id));
  const record = (id: string, opponents?: Set<string>) => {
    const gs = games(id).filter(
      (g) => !opponents || g.teams.some((o) => o !== id && opponents.has(o)),
    );
    return {
      wins: gs.filter((g) => g.winner === id).length,
      losses: gs.filter((g) => g.winner !== id).length,
      played: gs.length,
    };
  };
  const pct = (id: string, opponents?: Set<string>) => {
    const r = record(id, opponents);
    return r.played ? r.wins / r.played : null;
  };
  const standings = members.map((t) => ({
    id: t.id,
    eligible: t.eligible,
    ...record(t.id),
    pct: pct(t.id),
  }));
  const fail = (reason: string) => {
    issues.push(reason);
    return [] as string[];
  };
  const top = (
    ids: string[],
    values: Record<string, number | null>,
    step: string,
  ) => {
    if (ids.some((id) => values[id] === null || !Number.isFinite(values[id])))
      return null;
    const best = Math.max(...ids.map((id) => values[id]!));
    const subset = ids.filter((id) => Math.abs(values[id]! - best) < 1e-12);
    trace.push({ step, ids: subset });
    return subset;
  };
  const opponents = (id: string) =>
    new Set(games(id).flatMap((g) => g.teams.filter((o) => o !== id)));
  const allValues = (ids: string[], f: (id: string) => number | null) =>
    Object.fromEntries(ids.map((id) => [id, f(id)]));
  const selected: string[] = [];
  function headOnlyGroups(ids: string[], depth = 0): string[][] {
    if (ids.length < 2 || depth > members.length) return [ids];
    const complete = ids.every((id) =>
      ids.every(
        (o) =>
          id === o ||
          finals.some((g) => g.teams.includes(id) && g.teams.includes(o)),
      ),
    );
    if (complete) {
      const values = allValues(ids, (id) => pct(id, new Set(ids)));
      const grouped = new Map<number, string[]>();
      for (const id of ids)
        grouped.set(values[id]!, [...(grouped.get(values[id]!) || []), id]);
      if (grouped.size > 1)
        return [...grouped]
          .sort((a, b) => b[0] - a[0])
          .flatMap(([_, group]) => headOnlyGroups(group, depth + 1));
      return [ids];
    }
    const beatAll = ids.find((id) =>
      ids.every(
        (o) =>
          o === id ||
          finals.some((g) => g.winner === id && g.teams.includes(o)),
      ),
    );
    if (beatAll)
      return [
        [beatAll],
        ...headOnlyGroups(
          ids.filter((id) => id !== beatAll),
          depth + 1,
        ),
      ];
    const loseAll = ids.find((id) =>
      ids.every(
        (o) =>
          o === id ||
          finals.some((g) => g.winner === o && g.teams.includes(id)),
      ),
    );
    if (loseAll)
      return [
        ...headOnlyGroups(
          ids.filter((id) => id !== loseAll),
          depth + 1,
        ),
        [loseAll],
      ];
    return [ids];
  }
  function tie(ids: string[], slots: number, depth = 0): string[] {
    if (depth > members.length * 5) return fail("Tiebreaker restart guard");
    if (ids.length <= slots) return ids;
    if (policy === "bigten-2026-top-records")
      return fail(
        "2026 Big Ten tied qualification requires current full-policy confirmation",
      );
    const set = new Set(ids),
      mini = finals.filter((g) => g.teams.every((id) => set.has(id)));
    const complete = ids.every((id) =>
      ids.every(
        (o) =>
          id === o ||
          mini.some((g) => g.teams.includes(id) && g.teams.includes(o)),
      ),
    );
    const beatAll = ids.find((id) =>
      ids.every(
        (o) =>
          o === id || mini.some((g) => g.winner === id && g.teams.includes(o)),
      ),
    );
    const loseAll = ids.find((id) =>
      ids.every(
        (o) =>
          o === id || mini.some((g) => g.winner === o && g.teams.includes(id)),
      ),
    );
    const reduced = (
      subset: string[] | null,
      step: string,
    ): string[] | null => {
      if (!subset || subset.length === ids.length) return null;
      if (subset.length === 1) {
        trace.push({ step, ids: subset });
        return [
          ...subset,
          ...(slots > 1
            ? tie(
                ids.filter((id) => id !== subset[0]),
                slots - 1,
                depth + 1,
              )
            : []),
        ];
      }
      if (policy === "big12-current")
        return tie(subset, 1, depth + 1).flatMap((first) => [
          first,
          ...(slots > 1
            ? tie(
                ids.filter((id) => id !== first),
                slots - 1,
                depth + 1,
              )
            : []),
        ]);
      return tie(subset, slots, depth + 1);
    };
    if (ids.length === 2 || complete) {
      const answer = reduced(
        top(
          ids,
          allValues(ids, (id) => pct(id, set)),
          "head-to-head",
        ),
        "head-to-head",
      );
      if (answer) return answer;
    } else if (beatAll) {
      trace.push({ step: "beat-all", ids: [beatAll] });
      return [
        beatAll,
        ...(slots > 1
          ? tie(
              ids.filter((id) => id !== beatAll),
              slots - 1,
              depth + 1,
            )
          : []),
      ];
    } else if (loseAll && (policy === "sec-current" || policy === "acc-2026")) {
      trace.push({ step: "lost-to-all eliminated", ids: [loseAll] });
      return tie(
        ids.filter((id) => id !== loseAll),
        slots,
        depth + 1,
      );
    }
    if (policy !== "acc-2026") {
      const common = ids.reduce(
        (s, id) => new Set([...s].filter((o) => opponents(id).has(o))),
        opponents(ids[0]),
      );
      if (common.size) {
        const answer = reduced(
          top(
            ids,
            allValues(ids, (id) => pct(id, common)),
            "all-common",
          ),
          "all-common",
        );
        if (answer) return answer;
      }
      const grouped = new Map<number, string[]>();
      for (const s of standings)
        if (s.pct !== null)
          grouped.set(s.pct, [...(grouped.get(s.pct) || []), s.id]);
      for (const [_, group] of [...grouped].sort((a, b) => b[0] - a[0])) {
        const orderedGroups =
          policy === "sec-current" ? headOnlyGroups(group) : [group];
        for (const ordered of orderedGroups) {
          const commonGroup = ordered.filter((id) => common.has(id));
          if (!commonGroup.length) continue;
          const answer = reduced(
            top(
              ids,
              allValues(ids, (id) => pct(id, new Set(commonGroup))),
              "highest-common",
            ),
            "highest-common",
          );
          if (answer) return answer;
        }
      }
      const answer = reduced(
        top(
          ids,
          allValues(ids, (id) => {
            const rs = [...opponents(id)].map((o) => record(o));
            const n = rs.reduce((n, r) => n + r.played, 0);
            return n ? rs.reduce((n, r) => n + r.wins, 0) / n : null;
          }),
          "conference-schedule-strength",
        ),
        "conference-schedule-strength",
      );
      if (answer) return answer;
      if (policy === "big12-current") {
        if (
          !options.eligibleWins ||
          ids.some(
            (id) =>
              !Number.isInteger(options.eligibleWins![id]) ||
              options.eligibleWins![id] < 0,
          )
        )
          return fail(
            "Verified eligible-win totals (FCS/exempt-game limits) missing",
          );
        const answer = reduced(
          top(ids, options.eligibleWins, "eligible-total-wins"),
          "eligible-total-wins",
        );
        if (answer) return answer;
      }
    }
    const metric =
      policy === "acc-2026"
        ? "team-success"
        : policy === "sec-current"
          ? "capped-relative-margin"
          : "team-rating";
    const e = options.external;
    if (
      !e ||
      e.metric !== metric ||
      !e.source ||
      !Number.isFinite(Date.parse(e.asOf)) ||
      Date.parse(e.asOf) > Date.parse(input.observedAt) ||
      ids.some((id) => !Number.isFinite(e.values[id]))
    )
      return fail(
        "Official SportSource " +
          metric +
          " unavailable; do not substitute model ratings",
      );
    if (!["higher", "lower"].includes(e.direction))
      return fail("External metric direction unspecified");
    const answer = reduced(
      top(
        ids,
        Object.fromEntries(
          ids.map((id) => [
            id,
            e.direction === "lower" ? -e.values[id] : e.values[id],
          ]),
        ),
        "SportSource " + metric,
      ),
      "SportSource " + metric,
    );
    if (answer) return answer;
    return fail(
      "Conference-administered draw unresolved; never synthesize coin toss",
    );
  }
  if (!issues.length) {
    let pool = standings
      .filter((t) => t.eligible === true && t.played > 0)
      .map((t) => t.id);
    while (selected.length < 2 && pool.length) {
      const best = Math.max(...pool.map((id) => pct(id)!));
      let group = pool.filter((id) => pct(id) === best);
      if (policy === "acc-2026") {
        const leaders = group.map((id) => record(id));
        const expanded = pool.filter((id) =>
          leaders.some(
            (l) =>
              record(id).played !== l.played &&
              (record(id).wins === l.wins || record(id).losses === l.losses),
          ),
        );
        group = [...new Set([...group, ...expanded])];
        if (
          new Set(group.map((id) => record(id).played)).size > 1 &&
          group.length > 2
        ) {
          fail(
            "ACC alternate-schedule multi-team branch requires additional reference cases",
          );
          break;
        }
        if (group.length > 1) {
          // ACC's definition is non-transitive: 8-1 ties 7-1, but not 7-2.
          // With one berth left, a lower-percentage survivor may face a newly
          // relevant alternate-schedule opponent before it earns that berth.
          let contender = tie(group, 1)[0];
          if (!contender) break;
          const compared = new Set(group);
          if (selected.length === 1) {
            for (let turn = 0; turn < members.length; turn++) {
              const r = record(contender);
              const challengers = pool.filter(
                (id) =>
                  !compared.has(id) &&
                  record(id).played !== r.played &&
                  (record(id).wins === r.wins ||
                    record(id).losses === r.losses),
              );
              if (!challengers.length) break;
              const nextGroup = [contender, ...challengers];
              if (nextGroup.length > 2) {
                fail(
                  "ACC alternate-schedule multi-team continuation unresolved",
                );
                contender = "";
                break;
              }
              trace.push({
                step: "ACC alternate-schedule continuation",
                ids: nextGroup,
              });
              for (const id of challengers) compared.add(id);
              contender = tie(nextGroup, 1)[0];
              if (!contender) break;
            }
          }
          if (!contender) break;
          selected.push(contender);
          pool = pool.filter((id) => id !== contender);
          continue;
        }
      }
      const seeds = tie(group, 2 - selected.length);
      if (!seeds.length) break;
      selected.push(...seeds);
      pool = pool.filter((id) => !seeds.includes(id));
    }
    if (selected.length !== 2)
      issues.push("Two championship participants not resolved");
  }
  return {
    conference,
    policy,
    standings,
    trace,
    issues: [...new Set(issues)],
    participants: issues.length ? [] : selected,
    definitive: false,
    shadow: true,
  };
}
