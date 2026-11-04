# Historical selection validation — November 2

NO-GO for public playoff-selection forecasts, brackets or probabilities. The smallest defensible next feature is a labelled multi-game resume-impact sandbox using confirmed as-of inputs and hypothetical outcome effects; its consumer UI and operating integration still need review before release. No weights were tuned in response to these results.

Reproducible offline runner: `node --experimental-strip-types scripts/validate-selection-windows.mjs`, with HISTORY_ROOT pointing to prepared archived inputs. It verifies original CSV Git blob identities, cutoff/poll dates and complete coverage. Fifteen archived windows across 2024/2025 were checked; three incomplete windows were excluded. Earlier four-team seasons are excluded rather than scored using a 12-team allocator. Repeated weekly cutoffs are correlated, not independent validation trials.

| Latest earlier cutoff | Candidate field | Poll baseline field | Candidate conditional seed MAE | Poll seed MAE |
|---|---:|---:|---:|---:|
| Dec 7, 2024 09:59Z | 11/12 | 11/12 | 2.82 | 2.45 |
| Dec 6, 2025 17:16Z | 11/12 | 11/12 | 0.55 | 0.36 |

2024 candidate includes Miami instead of Clemson; poll control includes Alabama instead of Clemson. 2025 candidate includes BYU instead of James Madison; poll control includes Notre Dame instead of James Madison. The fixed champion proxy, not only resume weights, can cause misses. Actual future champions never enter feature inputs. Qualification and unknown eligibility remain proxy assumptions.

The candidate beats the poll membership control in one of twelve complete windows, ties in six, and loses in five. On November 23/30, 2025 it selects 9/12 versus the poll control's 11/12. These paired counts are descriptive, not a significance test. No single team or missed selection was used to optimize weights.

New independent committee-rank metric: 2024 official final Top 25 labels are separately sourced from https://collegefootballplayoff.com/news/2024/12/8/cfp-rankings-241208 . At the latest cutoff, candidate rank MAE is 2.60 positions versus poll control 1.12 (all 25 matched). This is distinct from seed error: 2024 champion byes reorder seeds. The 2025 seeded field was rechecked against https://collegefootballplayoff.com/sports/2026/1/27/cfp-recap-2526 ; its full committee-order endpoint was unavailable in this review, so no 2025 committee-rank accuracy is claimed.

Four selection-contract tests and one new genuine as-of multi-game test pass; focused lint/strict typing pass. Existing multi-game functionality, source immutability, third-party effects and order independence remain intact. No full rebuild or unrelated regression suite repeated. No production configuration, notification behavior, credentials, polling, Game Center or Pulse change.

November 3 at 7 PM Eastern remains the announced publication boundary, not a successful ingestion receipt. The prepared read-only capture process has not yet observed that publication; committee/source/app rows must be compared afterward.

Full per-window/model metrics and false/missed selections: workspace outputs/selection-validation-nov2/report.json. Full rankings labels are outcome-only and never supplied to the model as features.
