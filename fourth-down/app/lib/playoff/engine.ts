import { createHash } from "node:crypto";
import { currentRecords, mergeLedger, validFinal } from "./ledger.ts";
import type { Edition, Inputs, ModelRow, Snapshot, Weights } from "./types";
export const candidates: Weights[] = [
  { id: "candidate-35-35-10-20", W: 35, R: 35, S: 10, P: 20 },
  { id: "resume-first-40-40-10-10", W: 40, R: 40, S: 10, P: 10 },
  { id: "poll-heavy-30-30-10-30", W: 30, R: 30, S: 10, P: 30 },
  ...[-5, 5].map((d) => ({
    id: `sensitivity-W${35 + d}-P${20 - d}`,
    W: 35 + d,
    R: 35,
    S: 10,
    P: 20 - d,
  })),
  ...[-5, 5].map((d) => ({
    id: `sensitivity-R${35 + d}-P${20 - d}`,
    W: 35,
    R: 35 + d,
    S: 10,
    P: 20 - d,
  })),
];
export function hash(value: unknown) {
  return createHash("sha256")
    .update(
      JSON.stringify(value, (_key, v) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(
              Object.keys(v)
                .sort()
                .map((k) => [k, v[k]]),
            )
          : v,
      ),
    )
    .digest("hex");
}
const mean = (a: number[]) =>
  a.length ? a.reduce((n, x) => n + x, 0) / a.length : null;
function anchors(input: Inputs): {
  editions: Edition[];
  issues: string[];
} {
  const latest = (id: string) =>
    input.editions
      .filter(
        (e) =>
          e.id === id &&
          e.season === input.season &&
          Date.parse(e.date) <= Date.parse(input.observedAt),
      )
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const cfp = latest("cfp");
  const selected = cfp
    ? [cfp]
    : ([latest("ap"), latest("coaches")].filter(Boolean) as Edition[]);
  const issues: string[] = [];
  if (!selected.length) issues.push("No valid published baseline");
  if (
    selected.some(
      (e) => Date.parse(input.observedAt) - Date.parse(e.date) > 8 * 86400000,
    )
  )
    issues.push("Published baseline older than eight days");
  for (const e of selected)
    if (
      e.ranks.length !== 25 ||
      new Set(e.ranks.map((t) => t.id)).size !== 25 ||
      new Set(e.ranks.map((t) => t.rank)).size !== 25 ||
      !e.ranks.every(
        (t) => Number.isInteger(t.rank) && t.rank >= 1 && t.rank <= 25,
      )
    )
      issues.push(`Invalid ${e.id} edition`);
  return { editions: selected, issues };
}
export function runShadow(
  input: Inputs,
  weights: Weights = candidates[0],
  provisional = false,
  parentId: string | null = null,
): Snapshot {
  if (
    [weights.W, weights.R, weights.S, weights.P].some(
      (n) => !Number.isFinite(n) || n < 0,
    ) ||
    weights.W + weights.R + weights.S + weights.P !== 100
  )
    throw Error("Weights must total 100");
  if (
    new Set(input.teams.map((t) => t.id)).size !== input.teams.length ||
    input.teams.some((t) => !/^\d{1,12}$/.test(t.id))
  )
    throw Error("Invalid or duplicate team identities");
  const now = Date.parse(input.observedAt);
  if (!Number.isFinite(now) || !Number.isInteger(input.season))
    throw Error("Invalid input epoch");
  const issues = [...input.coverage.issues];
  if (!input.coverage.complete) issues.push("Incomplete season coverage");
  if (input.pendingGames?.length)
    issues.push(
      `Future participants unresolved in ${input.pendingGames.length} schedule entries`,
    );
  const anchor = anchors(input);
  issues.push(...anchor.issues);
  const records = currentRecords(input);
  for (const t of input.teams)
    if (records[t.id].status === "conflict")
      issues.push(`Record reconciliation required: ${t.id}`);
  const stale = input.games.some(
    (g) =>
      g.state === "in" &&
      (now - Date.parse(g.observedAt) > 120000 ||
        Date.parse(g.observedAt) > now + 30000),
  );
  if (stale && provisional)
    issues.push("Live overlay withheld: stale/future observation");
  const assumptions: Snapshot["assumptions"] = [];
  const games = mergeLedger([], input.games)
    .filter((g) => g.season === input.season)
    .map((g) => {
      if (!provisional || stale || g.state !== "in") return g;
      const elapsed = now - Date.parse(g.date);
      const validPeriod =
        Number.isInteger(g.period) && g.period! >= 1 && g.period! <= 20;
      const plausible =
        validPeriod &&
        elapsed >= 0 &&
        (g.period! < 4 || elapsed >= 90 * 60000) &&
        (g.period! <= 4 || elapsed >= 120 * 60000);
      if (
        !plausible ||
        !g.scores.every((n) => Number.isInteger(n) && n! >= 0) ||
        g.scores[0] === g.scores[1]
      )
        return g;
      const winner = g.teams[g.scores[0]! > g.scores[1]! ? 0 : 1];
      assumptions.push({ gameId: g.id, winner });
      return { ...g, state: "post" as const, completed: true, winner };
    });
  const finals = games.filter((g) => validFinal(g, now));
  const fbs = new Set(input.teams.map((t) => t.id));
  const workingRecords = currentRecords({
    ...input,
    games,
    teams: input.teams.map((t) => ({
      ...t,
      reportedRecord: undefined,
      reportedConferenceRecord: undefined,
    })),
  });
  const totals = new Map<
      string,
      {
        w: number;
        n: number;
      }
    >(),
    pairs = new Map<
      string,
      {
        w: number;
        n: number;
      }
    >();
  for (const g of finals)
    for (const id of g.teams) {
      const other = g.teams.find((x) => x !== id)!,
        t = totals.get(id) || { w: 0, n: 0 },
        p = pairs.get(id + ":" + other) || { w: 0, n: 0 };
      t.n++;
      p.n++;
      if (g.winner === id) {
        t.w++;
        p.w++;
      }
      totals.set(id, t);
      pairs.set(id + ":" + other, p);
    }
  const q = (opponent: string, excluding: string) => {
    const t = totals.get(opponent) || { w: 0, n: 0 },
      p = pairs.get(opponent + ":" + excluding) || { w: 0, n: 0 };
    return (t.w - p.w + 1) / (t.n - p.n + 2);
  };
  const pscore = (id: string) => {
    if (anchor.issues.length) return 0;
    const rank = (e: Edition) => {
      const r = e.ranks.find((t) => t.id === id)?.rank;
      return r ? (26 - r) / 25 : 0;
    };
    if (anchor.editions[0]?.id === "cfp") return rank(anchor.editions[0]);
    const ap = anchor.editions.find((e) => e.id === "ap"),
      coaches = anchor.editions.find((e) => e.id === "coaches");
    return ap && coaches
      ? 0.75 * rank(ap) + 0.25 * rank(coaches)
      : rank((ap || coaches)!);
  };
  const rows: ModelRow[] = input.teams.map((t) => {
    const own = finals.filter((g) => g.teams.includes(t.id));
    const quality = own.map((g) => {
      const opponent = g.teams.find((x) => x !== t.id)!,
        strength = fbs.has(opponent) ? q(opponent, t.id) : null,
        won = g.winner === t.id;
      return {
        gameId: g.id,
        opponent,
        outcome: won ? "win" : "loss",
        q: strength,
        contribution:
          strength === null
            ? won
              ? 0.25
              : -1
            : won
              ? 0.5 + 0.5 * strength
              : -(1 - 0.5 * strength),
      };
    });
    const rec = workingRecords[t.id],
      S = mean(quality.flatMap((x) => (x.q === null ? [] : [x.q])));
    const components = {
      W: rec.games ? rec.wins / rec.games : 0,
      R: ((mean(quality.map((x) => x.contribution)) ?? 0) + 1) / 2,
      S,
      P: pscore(t.id),
    };
    const raw =
      weights.W * components.W +
      weights.R * components.R +
      weights.S * (S ?? 0) +
      weights.P * components.P;
    const remaining = input.games
      .filter(
        (g) =>
          g.season === input.season &&
          g.state === "pre" &&
          g.teams.includes(t.id),
      )
      .flatMap((g) => {
        const opp = g.teams.find((x) => x !== t.id)!;
        return fbs.has(opp) ? [q(opp, t.id)] : [];
      });
    return {
      id: t.id,
      name: t.name,
      position: 0,
      score: Math.round(raw * 1e6) / 1e6,
      components,
      record: rec.overall,
      conferenceRecord: rec.conference,
      remainingDifficulty:
        input.coverage.futureComplete === false ? null : mean(remaining),
      quality,
      modelTie: false,
    };
  });
  // Tie keys are computed once for the whole group, avoiding non-transitive pair comparators.
  const tied = new Map<number, ModelRow[]>();
  for (const r of rows) tied.set(r.score, [...(tied.get(r.score) || []), r]);
  const tieKeys = new Map<string, number[]>();
  for (const group of tied.values()) {
    const ids = new Set(group.map((x) => x.id));
    const mini = finals.filter((g) => g.teams.every((id) => ids.has(id)));
    const complete =
      group.length > 1 &&
      group.every((t) =>
        group.every(
          (o) =>
            t.id === o.id ||
            mini.some((g) => g.teams.includes(t.id) && g.teams.includes(o.id)),
        ),
      );
    const unbeaten = group.find(
      (t) =>
        group.length > 1 &&
        group.every(
          (o) =>
            t.id === o.id ||
            mini.some(
              (g) =>
                g.teams.includes(t.id) &&
                g.teams.includes(o.id) &&
                g.winner === t.id,
            ),
        ) &&
        !mini.some((g) => g.teams.includes(t.id) && g.winner !== t.id),
    );
    const opponents = (id: string) =>
      new Set(
        finals
          .filter((g) => g.teams.includes(id))
          .flatMap((g) => g.teams.filter((x) => x !== id && !ids.has(x))),
      );
    const common = group.reduce(
      (set, t) => new Set([...set].filter((x) => opponents(t.id).has(x))),
      opponents(group[0].id),
    );
    for (const r of group) {
      const h = mini.filter((g) => g.teams.includes(r.id));
      const cg = finals.filter(
        (g) => g.teams.includes(r.id) && g.teams.some((id) => common.has(id)),
      );
      tieKeys.set(r.id, [
        unbeaten?.id === r.id ? 1 : 0,
        complete
          ? h.filter((g) => g.winner === r.id).length / (h.length || 1)
          : 0,
        cg.length ? cg.filter((g) => g.winner === r.id).length / cg.length : 0,
        r.components.W,
        r.components.P,
      ]);
      r.modelTie = group.length > 1;
    }
  }
  rows.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const ak = tieKeys.get(a.id)!,
      bk = tieKeys.get(b.id)!;
    for (let i = 0; i < ak.length; i++)
      if (ak[i] !== bk[i]) return bk[i] - ak[i];
    return Number(a.id) - Number(b.id);
  });
  rows.forEach((r, i) => (r.position = i + 1));
  const fieldReasons = [
    "Shadow-only testing candidate; not approved for public selection",
    "2026 conference tiebreaker adapters not verified",
    ...(input.teams.some((t) => t.eligible === null)
      ? ["Season eligibility not fully verified"]
      : []),
    ...issues,
  ];
  issues.sort();
  fieldReasons.sort();
  const semantic = {
    parentId,
    fieldReasons: [...new Set(fieldReasons)],
    version: "resume-shadow-v1.1.0",
    rules: input.rulesVersion,
    weights,
    mode: provisional ? "provisional" : "confirmed",
    anchors: anchor.editions,
    assumptions,
    rows,
    issues,
  };
  return {
    schema: 1,
    modelVersion: "resume-shadow-v1.1.0",
    rulesVersion: input.rulesVersion,
    shadow: true,
    mode: provisional ? "provisional" : "confirmed",
    at: input.observedAt,
    id: hash(semantic),
    inputHash: hash(input),
    weights,
    parentId,
    anchorIds: anchor.editions.map((e) => `${e.id}:${e.date}`),
    assumptions,
    rows,
    issues,
    field: { definitive: false, reasons: [...new Set(fieldReasons)] },
    inputs: structuredClone(input),
  };
}
export function compareSnapshots(before: Snapshot, after: Snapshot) {
  if (
    before.modelVersion !== after.modelVersion ||
    hash(before.weights) !== hash(after.weights) ||
    before.inputs.season !== after.inputs.season ||
    before.rulesVersion !== after.rulesVersion
  )
    throw Error("Incompatible model epochs");
  return after.rows.flatMap((r) => {
    const old = before.rows.find((x) => x.id === r.id);
    if (!old || (old.position === r.position && old.score === r.score))
      return [];
    return [
      {
        id: r.id,
        name: r.name,
        from: old.position,
        to: r.position,
        movement: old.position - r.position,
        scoreDelta: r.score - old.score,
        componentDeltas: Object.fromEntries(
          Object.keys(r.components).map((k) => {
            const key = k as keyof typeof r.components;
            return [
              k,
              r.components[key] === null || old.components[key] === null
                ? null
                : r.components[key]! - old.components[key]!,
            ];
          }),
        ),
        changedGames: r.quality
          .filter((g) => !old.quality.some((o) => hash(o) === hash(g)))
          .map((g) => g.gameId),
        anchorChanged: hash(before.anchorIds) !== hash(after.anchorIds),
      },
    ];
  });
}
