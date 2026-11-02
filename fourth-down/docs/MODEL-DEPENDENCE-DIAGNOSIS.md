# Private model diagnosis and next validation decision — November 2

Do not activate selection forecasts. An algebraic defect in the interpretation of the current components is now documented: for a team with only tracked FBS opponents, `R = 0.75 W + 0.25 S` exactly. A win contributes `0.5 + 0.5q`; a loss contributes `-1 + 0.5q`; averaging and rescaling gives the identity. Thus 35W/35R/10S/20P effectively becomes **61.25W/18.75S/20P**, not three independent resume signals. The opponent-strength term has the same slope for wins and losses; it is not an independent quality-win/strength-of-record estimate. Fixed untracked-opponent contributions alter the identity for teams with FCS opponents.

The diagnostic reruns the frozen candidate only on the latest genuine complete 2024 and 2025 vintages, verifying original CSV Git identities and as-of constraints first. Across 134/136 tracked teams, W/R correlations are 0.99578/0.99635. The exact identity holds within 1.12e-16 for 15/10 all-FBS schedules. This is measured feature redundancy, not proof of the causal size of selection error. It explains why small redistributions between W and R are unlikely to add new information. The existing championship/eligibility proxy remains a separate source of misses.

## Recommendation

1. Preserve the current model and scenario engine as frozen replay references; keep public factual What If tools independent.
2. Separate committee-order evaluation from qualification allocation. Evaluate new ordering features against the poll baseline before claiming a better selected field; do not mask unknown future champions with actual future outcomes.
3. Preregister one genuinely distinct quality feature and a poll-plus-residual baseline before new evaluation. Require the feature to pass an outcome/strength interaction test (beating a strong opponent must add information beyond W+SOS), use only verified as-of inputs, and disclose untracked opponents.
4. Freeze configurations and forecast artifacts before future committee publication. The November 3 official Top25 is a useful prospective committee-order target, **not a final-playoff-selection target**. The final 2026 selection is a separate target; conference eligibility/rules must be verified separately.
5. Use rank error/top25 coverage for committee order, field membership errors for final selection, and format-correct seed error only after selection/qualification. Report correlated weekly windows honestly. No numerical probabilities until calibration is independently validated.

No new scoring formula or weight change is introduced by this diagnostic. Previously inspected 2024/2025 outcomes are development evidence, not untouched out-of-sample confirmation. A stronger public predictor still needs genuinely prospective/untouched evidence and defensible qualification handling. Do not tune to Tennessee or any individual inclusion.

Reproduce: `node --experimental-strip-types scripts/diagnose-component-overlap.mjs`. Output: workspace `outputs/selection-validation-nov2/component-overlap.json`. No provider requests, production writes, settings or notification changes.
