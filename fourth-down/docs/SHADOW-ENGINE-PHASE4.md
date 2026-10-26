# Phase 4 shadow validation — October 26, 2026

The engine remains private and unapproved for public activation. Released Team Pages are reconciled from production commit f2c3e6f. No notification code, credentials, production schedules, preferences, or services were changed by this phase. Mascot changes are isolated in PR #23.

## Implemented

- A season-specific Pac-12 championship adapter separates participant selection and host order from CFP selection/seeding. It excludes championship and flex fixtures, restarts narrowed ties correctly, validates the specified CFP edition and official SportSource metric, and withholds decisions without required evidence. Midseason conference audits deliberately withhold definitive participants.
- Opt-in `resume-shadow-v1.2.0` accepts genuine competition-ranked tied poll editions. Version 1.1 remains the default and is frozen for replay. This validator is private: the separate AP tied-rank notification issue is untouched.
- Eligibility evidence is audited by jurisdiction. Bowl eligibility does not establish institutional CFP or conference-championship eligibility. New Indiana and UTSA bowl-only evidence does not clear the remaining institutional universe.
- An offline write-budget admission planner requires complete operating-day evidence, reserves existing traffic, and checks storage headroom and malformed inputs. It does not install a writer or authorize production activation.

## Rules and remaining evidence

Authoritative CFP format: https://collegefootballplayoff.com/sports/2024/5/29/12-team-format . Apply the four Power Four champion qualifications, the protected highest-ranked team from the other six leagues, Notre Dame protection where applicable, and rank-based seeding independently of résumé order. Do not substitute a universal Group-of-Six championship requirement.

Pac-12 2026 procedure: https://pac-12.com/news/2026/9/3/pac-12-announces-commercial-and-operational-updates-ahead-of-its-2026-football-season-kickoff.aspx . External CFP/SportSource criteria are required only when the preceding tie criteria fail; missing values withhold the decision.

Big Ten confirms top-two conference records: https://bigten.org/news/2026/8/19/championship-2026-discover-big-ten-football-championship-game-information.aspx . Current-season primary confirmation of the complete tiebreaker procedure remains missing. Older procedures must not be silently promoted to verified 2026 rules. ACC mixed eight/nine-game reference cases and relevant institutional eligibility clearance remain activation blockers. Existing eligibility audit has only two institutionally verified teams, not 138. Some other conference sources retain stale rosters or lack confirmed 2026 applicability.

The 14 future fixtures are already classified: ten contingent championship slots and four Pac-12 flex slots. Their opponents cannot yet be assigned from verified outcomes. They are not fabricated regular-season fixtures.

## Historical validation

Genuine as-of-date game vintages and published poll editions were reused without adding future outcomes. Poll retrieval is retrospective with a conservative lag; this is not first-publication receipt evidence. Missing historical finals remain excluded.

| Season | v1.2 candidate correct ordering | Colley baseline | Windows |
| --- | --- | --- | --- |
| 2024 | 113/173 | 113/173 | 5 |
| 2025 | 200/287 | 203/287 | 8 |

Seven frozen weight configurations were compared without team-specific tuning. Alternative configurations score 110–113/173 in 2024 and 198–200/287 in 2025. The candidate has no demonstrated superiority. Expanded tied-edition coverage changes the 2024 denominator; comparison against prior v1.1 totals is not a weighting improvement. These are next-game ordering checks, not CFP selection accuracy, independent trials, or calibrated probabilities.

All 75 retained v1.1 snapshots replay exactly. Legacy schemas were not rewritten. New archives preserve model version and reject cross-version movement comparisons.

## Operational evidence

Read-only native Upstash observation at 2026-10-26T21:19Z: approximately 49,000/500,000 monthly Redis commands, 23/250 MB storage, 698 MB/10 GB bandwidth, and $0 cost. Chart values are rounded. Complete daily samples: October 23 about 4,900 commands; October 24 about 19,000; October 25 about 14,000. Installation day and current UTC day are partial. Seven complete operating days do not yet exist, so a sustainable weekly write budget is not established. Retry billing, shared function costs and persistence transport remain unmeasured. No additional QStash messages or schedules were introduced.

## Validation and readiness

275 tests pass; lint, production build and type checking pass. Current-record browser regressions pass in Chromium, Firefox, desktop WebKit and iPhone-sized WebKit. Favorite controls pass Chromium/WebKit simulations. Desktop push tests use simulated browser/server interfaces and are not real-device delivery evidence. Additional browser results are recorded separately as they complete.

Recommendation: retain shadow mode. Public activation requires authoritative unresolved rule/eligibility evidence, stronger selection-oriented validation, and a measured persistence/operating budget. No merge, public model activation, paid upgrade, schedule change, or deployment is authorized by this report.
