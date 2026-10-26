/** Official qualification dependencies are not extra résumé-model weights. */
export const qualificationDependencies = {
  "pac12-2026": ["specific-cfp-edition", "team-rating", "conference-draw"],
  "acc-2026": ["team-success", "conference-draw"],
  "big12-current": ["eligible-total-wins", "team-rating", "conference-draw"],
  "sec-current": ["capped-relative-margin", "conference-draw"],
  "bigten-2026-top-records": ["current-full-policy-confirmation"],
} as const;

export function requiredEvidence(
  policy: keyof typeof qualificationDependencies,
  issues: string[],
) {
  const unresolved = qualificationDependencies[policy].filter((metric) => {
    if (metric === "specific-cfp-edition")
      return issues.some((i) => i.includes("Tuesday-before-week-13 CFP edition unavailable"));
    if (metric === "current-full-policy-confirmation")
      return issues.some((i) => i.includes("full-policy confirmation"));
    if (metric === "conference-draw")
      return issues.some((i) => i.includes("draw unresolved"));
    if (metric === "eligible-total-wins")
      return issues.some((i) => i.includes("eligible-win"));
    return issues.some((i) => i.includes(metric + " unavailable"));
  });
  return {
    policy,
    requiredNow: unresolved,
    optionalForResumeModel: [
      "team-success",
      "team-rating",
      "capped-relative-margin",
    ],
    qualificationResolved: issues.length === 0,
    explanation:
      "Later tiebreakers are required only if earlier verified criteria fail. Missing official values never use the independent model as a substitute.",
  };
}
