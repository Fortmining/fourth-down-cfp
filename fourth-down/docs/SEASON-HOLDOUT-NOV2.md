# Private season-holdout diagnosis — November 2

Public selection predictions remain NO-GO. Reused frozen archived forecasts rather than rebuilding unchanged features or tuning to teams. The new `selection-season-holdout.py` chooses among seven existing configurations on five 2024 windows by mean field membership, then error penalizing missing teams, then configuration ID. It evaluates the chosen configuration on seven 2025 windows without refitting.

| Configuration | 2024 mean correct /12 | 2025 mean correct /12 | 2025 mean all-team seed error |
|---|---:|---:|---:|
| Initial 35/35/10/20 | 8.8 | 9.0 | 4.488 |
| 2024-selected W35/R30/S10/P25 | 9.0 | 9.0 | 4.548 |
| Published-poll control | 9.0 | 9.714 | 3.798 |

Reducing the resume-result component improved development selection membership slightly but did not generalize to better 2025 membership or seed error. This rejects a simple weight-tuning fix with current evidence; production/private engine weights and multi-game implementation remain unchanged.

Two separate weaknesses remain: the resume score optimizes a transparent independent evaluation, not learned committee behavior; and the shared highest-ordered-team-per-conference champion proxy cannot resolve future championship upsets. The common latest-window misses (2024 Clemson, 2025 James Madison) are consistent with qualification assumptions contributing to errors, but this analysis does not establish that as their sole cause. Fixing weights cannot validate championship qualification. Unknown historical eligibility and correlated weekly windows further weaken any selection claim.

2025 outcomes were already inspected in previous work. This is a retrospective out-of-season holdout, **not a pristine unseen validation set**. No statistically independent improvement, probability calibration or trustworthy bracket forecast is established. A genuine new holdout requires a sealed future cutoff/season or independently sourced historical inputs not used in decisions; don't relabel existing inspected data as untouched.

Output: `outputs/selection-validation-nov2/season-holdout.json`, which records the input report SHA-256, selected configuration and all training configurations. Uses existing vintage-verified as-of forecasts; no future outcome enters feature computation. No source fetch, notification, schedule, user-state, credential or service change.
