import { candidates, runShadow, hash } from "./engine.ts";
import { validFinal, mergeLedger } from "./ledger.ts";
import { powerFour } from "./qualification.ts";
import { championshipSlots, scheduleAudit } from "./schedule.ts";
import type { Inputs } from "./types";

/** A range across seven fixed models is sensitivity, never a selection probability. */
export function modelSensitivity(input: Inputs) {
  const snapshots = candidates.map((w) => runShadow(input, w));
  return {
    inputHash: hash(input),
    models: snapshots.map((s) => ({ id: s.weights.id, snapshot: s.id })),
    rows: input.teams.map((t) => {
      const positions = snapshots.map(
        (s) => s.rows.find((r) => r.id === t.id)!.position,
      );
      return {
        id: t.id,
        minPosition: Math.min(...positions),
        maxPosition: Math.max(...positions),
        top12ResumeModels: positions.filter((p) => p <= 12).length,
        models: positions.length,
      };
    }),
    label:
      "Independent resume position range across fixed testing models; not CFP selection likelihood",
    fieldWithheld: true,
  };
}

/** Actual title-game winners, not regular-season leaders or model-generated champions. */
export function championshipContext(input: Inputs) {
  const finals = mergeLedger([], input.games).filter((g) =>
    validFinal(g, Date.parse(input.observedAt)),
  );
  const champions = powerFour.map((conference) => {
    const games = finals.filter(
      (g) =>
        input.season === 2026 &&
        championshipSlots[g.id]?.conference === conference,
    );
    const winner = games.length === 1 ? games[0].winner : null;
    const team = input.teams.find(
      (t) =>
        t.id === winner && t.conference === conference && t.eligible === true,
    );
    return {
      conference,
      confirmedChampion: team?.id ?? null,
      gameId: games.length === 1 ? games[0].id : null,
      reason: team
        ? "Verified title-game final and institutional eligibility"
        : "Championship result or eligibility unresolved",
    };
  });
  return {
    champions,
    schedule: scheduleAudit(input),
    officialRankingOrderUnchanged: true,
    definitiveField: false,
  };
}
