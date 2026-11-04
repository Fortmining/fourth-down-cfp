import { simulateConferenceTitle } from "./championship-trial.ts";
import { allocateShadowField, powerFour } from "./qualification.ts";
import type { Inputs, ModelRow } from "./types.ts";

type TitleInput = Parameters<typeof simulateConferenceTitle>[1];

/** One private trial. An unresolved title or field counts as a withheld trial. */
export function resolvePlayoffTrial(
  input: Inputs,
  titles: readonly TitleInput[],
  estimateOrder: (champions: Readonly<Record<string, string>>) => ModelRow[],
) {
  const champions: Record<string, string> = {};
  const issues: string[] = [];
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
    }
  }
  if (issues.length || !powerFour.every(conference => champions[conference])) {
    return { status: "withheld" as const, issues: issues.length ? issues : ["Missing Power Four winner"] };
  }
  const rows = estimateOrder(Object.freeze(champions));
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
