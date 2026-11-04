import { simulateConferenceTitle } from "./championship-trial.ts";
import { runSeasonDraws } from "./season-draws.ts";
import { allocateShadowField, powerFour } from "./qualification.ts";
import type { Inputs, ModelRow } from "./types.ts";

type TitleInput = Parameters<typeof simulateConferenceTitle>[1];

/** One private trial. An unresolved title or field counts as a withheld trial. */
export function resolvePlayoffTrial(
  input: Inputs,
  titles: readonly TitleInput[],
  estimateOrder: (champions: Readonly<Record<string, string>>, titleParticipants: readonly string[]) => ModelRow[],
) {
  const champions: Record<string, string> = {};
  const issues: string[] = [];
  const titleParticipants: string[] = [];
  if (input.season !== 2026 || titles.length !== powerFour.length) {
    return { status: "withheld" as const, issues: ["Four 2026 title games required"] };
  }
  for (const title of titles) {
    const result = simulateConferenceTitle(input, title);
    if (result.status === "withheld") {
      issues.push(...result.issues.map(issue => `${title.fixtureId}: ${issue}`));
    } else if (champions[result.conference]) {
      issues.push("Repeated conference title");
    } else {
      champions[result.conference] = result.winner;
      titleParticipants.push(...result.participants);
    }
  }
  if (issues.length || !powerFour.every(conference => champions[conference])) {
    return { status: "withheld" as const, issues: issues.length ? issues : ["Missing Power Four winner"] };
  }
  const rows = estimateOrder(Object.freeze(champions), titleParticipants);
  const rankedIds = new Set(rows.map(row => row.id));
  if (rankedIds.size !== rows.length ||
      rows.length !== input.teams.length ||
      input.teams.some(team => !rankedIds.has(team.id))) {
    return { status: "withheld" as const, issues: ["Incomplete or duplicate committee model ordering"] };
  }
  const field = allocateShadowField(rows, input.teams, champions, true);
  if (field.issues.length) return { status: "withheld" as const, issues: field.issues };
  return { status: "simulated" as const, hypothetical: true as const, champions, ...field };
}

/** Aggregate all trials, including withheld trials, against the same denominator. */
export function runPlayoffBatch(
  games: Parameters<typeof runSeasonDraws>[0],
  options: Parameters<typeof runSeasonDraws>[1],
  resolve: (winners: ReadonlyMap<string, string>, index: number) => ReturnType<typeof resolvePlayoffTrial>,
) {
  const appearances: Record<string, number[]> = Object.create(null);
  const withheldReasons: Record<string, number> = Object.create(null);
  let total = 0;
  let resolved = 0;

  const ids = games.map(game => game.id).sort((a, b) => a.localeCompare(b));
  runSeasonDraws(games, options, winners => {
    const trial = resolve(new Map(ids.map((id, index) => [id, winners[index]])), total++);

    if (trial.status === "withheld") {
      for (const issue of new Set(trial.issues)) {
        withheldReasons[issue] = (withheldReasons[issue] ?? 0) + 1;
      }
      return;
    }
    resolved++;
    for (const team of trial.field) {
      const seeds = appearances[team.id] ??= Array<number>(12).fill(0);
      seeds[team.seed - 1]++;
    }
  });

  return {
    total,
    resolved,
    withheld: total - resolved,
    withheldReasons,
    seedCounts: appearances,
    // Even a complete batch needs independent model validation before display.
    complete: total > 0 && total === resolved,
  };
}
