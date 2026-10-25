import { createHash } from "node:crypto";
import { candidates, runShadow } from "./engine.ts";
import { validFinal } from "./ledger.ts";
import { colleyReference } from "./colley-reference.ts";
import type { Inputs } from "./types";
export type GitVintage = {
  sha: string;
  blob: string;
  date: string;
  inputs: Inputs;
};
export function verifyGitVintage(v: GitVintage, csvBytes: Uint8Array) {
  const blob = createHash("sha1")
    .update("blob " + csvBytes.length + "\0")
    .update(csvBytes)
    .digest("hex");
  const at = Date.parse(v.date);
  const errors: string[] = [];
  if (!/^[a-f0-9]{40}$/.test(v.sha) || blob !== v.blob)
    errors.push("Git source identity mismatch");
  if (!Number.isFinite(at) || v.inputs.observedAt !== v.date)
    errors.push("Invalid committed observation epoch");
  if (v.inputs.rulesVersion !== "historical-resume-no-qualification-v1")
    errors.push("Historical qualification must remain disabled");
  if (
    v.inputs.games.some(
      (g) =>
        g.observedAt !== v.date ||
        g.season !== v.inputs.season ||
        (g.completed && Date.parse(g.date) > at),
    )
  )
    errors.push("Future or wrong-vintage game input");
  // Historical feeds use midnight dates; allow a full day so they cannot imply an early Sunday publication.
  if (
    v.inputs.editions.some(
      (e) =>
        e.season !== v.inputs.season ||
        !Number.isFinite(Date.parse(e.date)) ||
        Date.parse(e.date) > at - 86400000,
    )
  )
    errors.push("Poll not established before archival cutoff");
  return { valid: errors.length === 0, errors };
}
export function historicalComparison(vintages: GitVintage[]) {
  const ordered = [...vintages].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
  const results = ordered.slice(0, -1).map((v, i) => {
    const next = ordered[i + 1];
    if (v.inputs.season !== next.inputs.season)
      throw Error("Cross-season holdout");
    const after = Date.parse(v.date),
      end = Math.min(Date.parse(next.date), after + 7 * 86400000);
    const ids = new Set(v.inputs.teams.map((t) => t.id));
    const priorFinals = new Set(
      v.inputs.games.filter((g) => validFinal(g, after)).map((g) => g.id),
    );
    // Outcomes are read ONLY after every candidate is scored from the earlier vintage.
    const models = candidates.map((w) => ({
      weights: w,
      snapshot: runShadow(v.inputs, w),
    }));
    const candidateRows = new Map(
      models[0].snapshot.rows.map((r) => [r.id, r]),
    );
    const controls = [
      {
        id: "colley-fbs-reference",
        values: new Map(
          colleyReference(v.inputs).rows.map((r) => [r.id, r.rating]),
        ),
      },
      {
        id: "current-win-percentage",
        values: new Map(
          models[0].snapshot.rows.map((r) => [r.id, r.components.W]),
        ),
      },
      {
        id: "published-poll-anchor",
        values: new Map(
          models[0].snapshot.rows.map((r) => [r.id, r.components.P]),
        ),
      },
    ];
    const outcomes = next.inputs.games.filter(
      (g) =>
        g.teams.every((id) => ids.has(id)) &&
        !priorFinals.has(g.id) &&
        Date.parse(g.date) > after &&
        Date.parse(g.date) < end &&
        validFinal(g, Date.parse(next.date)),
    );
    return {
      asOf: v.date,
      commit: v.sha,
      nextObservation: next.date,
      coverageComplete: v.inputs.coverage.complete,
      issues: v.inputs.coverage.issues,
      outcomes: outcomes.length,
      controls: controls.map((control) => {
        let scored = 0,
          correct = 0,
          candidateCorrect = 0;
        for (const g of outcomes) {
          const a = control.values.get(g.teams[0])!,
            b = control.values.get(g.teams[1])!,
            ca = candidateRows.get(g.teams[0])!,
            cb = candidateRows.get(g.teams[1])!;
          if (a === b || ca.score === cb.score) continue;
          scored++;
          if ((a > b ? g.teams[0] : g.teams[1]) === g.winner) correct++;
          if ((ca.score > cb.score ? ca.id : cb.id) === g.winner)
            candidateCorrect++;
        }
        return {
          id: control.id,
          scored,
          correct,
          candidateCorrectOnSameGames: candidateCorrect,
        };
      }),
      models: models.map(({ weights, snapshot }) => {
        const rows = new Map(snapshot.rows.map((r) => [r.id, r]));
        let correct = 0,
          tied = 0;
        for (const g of outcomes) {
          const a = rows.get(g.teams[0])!,
            b = rows.get(g.teams[1])!;
          if (a.score === b.score) {
            tied++;
            continue;
          }
          if ((a.score > b.score ? a.id : b.id) === g.winner) correct++;
        }
        return {
          id: weights.id,
          snapshotId: snapshot.id,
          top12Resume: snapshot.rows.slice(0, 12).map((t) => t.id),
          correct,
          scored: outcomes.length - tied,
          tied,
          agreement:
            outcomes.length > tied ? correct / (outcomes.length - tied) : null,
        };
      }),
    };
  });
  const aggregate = candidates.map((w) => {
    const rs = results
      .filter((r) => r.coverageComplete)
      .flatMap((r) => r.models.filter((m) => m.id === w.id));
    const scored = rs.reduce((n, r) => n + r.scored, 0),
      correct = rs.reduce((n, r) => n + r.correct, 0);
    return {
      id: w.id,
      correct,
      scored,
      agreement: scored ? correct / scored : null,
    };
  });
  return {
    label:
      "Version-pinned 2025 out-of-sample résumé-order agreement with next seven-day FBS game results",
    results,
    aggregate,
    controls: [
      "colley-fbs-reference",
      "current-win-percentage",
      "published-poll-anchor",
    ].map((id) => {
      const rs = results
        .filter((r) => r.coverageComplete)
        .flatMap((r) => r.controls.filter((c) => c.id === id));
      return {
        id,
        scored: rs.reduce((n, r) => n + r.scored, 0),
        correct: rs.reduce((n, r) => n + r.correct, 0),
        candidateCorrectOnSameGames: rs.reduce(
          (n, r) => n + r.candidateCorrectOnSameGames,
          0,
        ),
      };
    }),
    selectionAccuracyValidated: false,
    playoffProbabilities: false,
    limitations: [
      "Git commit metadata is archival evidence, not an ESPN first-publication receipt",
      "Historical published poll editions were retrieved later and conservatively lagged by at least 24 hours",
      "Incomplete input vintages are excluded from aggregate",
      "Résumé ordering is not a calibrated game predictor or CFP selection forecast",
      "Small, overlapping team samples; no weights were selected or tuned using these results",
    ],
  };
}
