# Live playoff engine — second validation pass, October 25, 2026

Later work is recorded in [Phase 3](SHADOW-ENGINE-PHASE3.md); figures below describe this earlier validation pass.

**Production assessment: do not activate or merge.** The existing candidate engine is preserved. This pass adds manual private shadow ingestion, stronger rule adapters, verified classifications for all pending fixtures, time-aware eligibility evidence, historical vintages and measured native resource use. No public projection, production shadow hook, Redis writer, schedule or paid service is activated.

## Implemented and preserved

- `ShadowSession` computes confirmed and provisional candidate snapshots from fresh inputs and persists immutable content-addressed receipts. It checks input hashes, rejects later observations at earlier cutoffs, serializes writes with an exclusive lock, and replaces the current head atomically. Out-of-order observations cannot rewrite history.
- Game-ID corrections replace valid prior outcomes. A transient scheduled/live or incomplete-score regression cannot erase an already verified Final. Missing/malformed observations remain diagnosable.
- Unchanged inputs, clock ticks and scoring changes that leave the candidate’s live assumptions unchanged do not create more historical snapshots/receipts. Live-assumption expiry is still evaluated on every observation and can change the provisional snapshot without changing actual records.
- Only the candidate runs by default. Comparing all seven configurations is an explicit offline option; it must not be silently added to every production poll.
- Compact input manifests deduplicate game facts and observation metadata. Local storage remains capped at 64 MiB and 768 model snapshots. A cap stops new history rather than deletes old evidence. Long-season shard/retention operations remain a deployment gate; this is not an unlimited archive.
- Actual polling, provider sends, subscriptions, favorites, notification categories, deduplication, cooldowns and service-worker behavior are untouched. The v0.8.4 alert fresh-fetch path does not invoke these modules. No new public route exposes the engine.

## Qualification and conference rules

The CFP’s published 2026 format reserves Power Four champions, the highest-ranked six-conference team, and the specified Notre Dame protection before at-large allocation. The prior tested allocation/seeding mechanics remain shadow-only. Independent résumé positions are not committee rankings or an official bracket.

| Area | Evidence and implementation | Still unresolved |
|---|---|---|
| CFP allocation/seeding | Published 2026 format; four byes, hosting pairs and protected/AQ allocation already tested | Future committee selection and future champions are not known |
| ACC | Full July 2026 policy retrieved. Direct/multi-team results, official-metric gates, and non-transitive 8–1 / 7–1 / 7–2 cases tested against the conference VP’s recorded explanation | Mixed-schedule groups larger than two need additional authoritative reference cases; Team Success Ranking when required |
| Big 12 | Complete updated PDF is open-ended from 2024 onward, unlike the stale summary labeled 2025. Common opponents, standings groups, schedule strength and eligible-win/metric gates implemented | Source-confirmed FCS/exempt-game win totals and official Team Rating Score where earlier criteria tie |
| SEC | Current official page links the full policy and examples; multi-team restarts and ordering within tied common-opponent groups tested | Final official capped relative margin/draw when required; do not substitute résumé scores |
| Big Ten | 2026 championship page confirms top conference records. Full available procedure is 2024, including its sanctions language | Carry-forward use remains explicitly unverified for 2026; adapter returns no qualified participants |
| Six other conferences | Championship slots identified. Their champions are not required for the highest-ranked G6 CFP automatic berth | Full conference-title forecasting/tiebreaker adapters are not implemented |

SportSource Team Success Ranking, Team Rating Score and the SEC scoring metric are distinct inputs. A supplied external metric requires its name, direction, source and observation time. Missing metrics stop qualification; a draw is never synthesized. Conference standings use verified results, including games against an ineligible opponent. Institutional eligibility and current conference membership are separate.

Primary sources: [CFP format](https://collegefootballplayoff.com/sports/2024/5/29/12-team-format), [ACC full policy](https://s3.amazonaws.com/sidearm.sites/acc.sidearmsports.com/documents/2026/7/15/ACC_Football_Tiebreaker_Policy_Jully_2026.pdf), [Big 12 updated full policy](https://s3.amazonaws.com/big12sports.com/documents/2025/11/4/Big_12_Football_2024_Tiebreaker_Policy.pdf), [SEC full policy](https://storage.googleapis.com/secsports-prod/upload/2024/10/29/f6fc7cd9-3031-4357-8754-80bfa4b9c4c0.pdf), [2026 Big Ten championship information](https://bigten.org/news/2026/8/19/championship-2026-discover-big-ten-football-championship-game-information.aspx). The [recorded interview with ACC vice president Michael Strickland](https://www.on3.com/sites/devils-illustrated/news/explaining-the-new-acc-tiebreaker-if-a-7-1-8-1-and-7-2-team-somehow-wind-up-tied/) supplies specific alternate-schedule reference scenarios; it is distinguished from the conference’s own policy publication.

### Eligibility

A season/source/time-specific evidence registry is implemented; conflicting assertions, future observations and prior-season assertions cannot certify a team. NDSU’s own current FAQ explicitly confirms 2026 championship/CFP/bowl eligibility, and its statement was re-fetched with a timestamp and content hash. Its FAQ revision/publication time is unknown, so no historical publication timestamp is invented. The other 137 teams remain unresolved by this strict registry. This does **not** mean those teams are ineligible; it means their institutional eligibility has not been individually certified here.

The June NCAA rule permits compliant transitioning institutions to participate; it does not certify every institution’s compliance. Sacramento State’s February FAQ still describes the former two-year restriction and must not automatically create a 2026 ban. No transition-status or six-win shortcut replaces the evidence registry.

Sources: [adopted NCAA proposal 2026-31](https://web3.ncaa.org/lsdbi/search/proposalView?id=109240), [NDSU institutional FAQ](https://gobison.com/sports/2026/2/9/fbs-frequently-asked-questions), [older Sacramento State FAQ](https://hornetsports.com/news/2026/2/16/hornet-football-to-join-the-mac-in-2026.aspx).

## The 14 fixtures

All 14 are now classified, with zero unknown categories:

- Four Pac-12 flex slots: fixed hosts are Colorado State, Fresno State, Utah State and Washington State. The conference says matchups may remain unset until six days before November 28. They cannot be assigned as facts on October 25. Flex games do not count toward conference standings; the ESPN adapter now prevents a future same-conference flex rematch from being miscounted.
- Ten conference-championship slots: the provider’s captured event notes identify the conferences. Participants are contingent on qualification; these are not ten missing regular-season opponent pairs.

Per-team schedule diagnostics therefore show complete known regular-season opponent coverage for 130 teams and flex uncertainty for the eight Pac-12 teams. The preserved v1.1 candidate still withholds its remaining-difficulty value conservatively when global future coverage is incomplete; no new remaining-schedule weight is introduced.

Sources: [Pac-12 schedule and assignment timing](https://pac-12.com/news/2026/6/30/general-the-new-pac-12-conference-officially-launches-with-the-addition-of-seven-full-time-members.aspx), [2026 Pac-12 operational rules, including non-conference flex games](https://pac-12.com/news/2026/9/3/pac-12-announces-commercial-and-operational-updates-ahead-of-its-2026-football-season-kickoff.aspx). ESPN event IDs/notes and normalized diagnostics are retained privately with the validation evidence.

## Genuine historical validation

Nine season ledgers were recovered from specific public Git commits dated October 5 through December 6, 2025. Each downloaded CSV’s Git blob hash is checked against its committed tree. Historical ESPN AP/Coaches editions, and CFP editions once available, are selected from their own publication dates at least 24 hours before the cutoff. This avoids treating ESPN’s midnight date fields as precise Sunday publication times. CFP remains the prioritized anchor once available.

Only the earlier committed ledger contributes inputs. The next vintage supplies held-out results after all candidate scores have been computed; an explicit test proves changing the later winners cannot change those earlier forecasts. Elo values, postgame win probabilities and excitement indices in the source CSV are discarded. No present-season membership or records enter the 2025 inputs, and no 2026 qualification rule is applied to a historical field.

There are eight forecast windows. Two contain a missing archived final score (`401762874` or `401762505`) and are excluded from the aggregate. The complete windows contain 288 outcomes; one equal-score ordering is unscored, leaving 287 common scored outcomes.

| Frozen model | Correct/scored | Agreement with next-game result |
|---|---:|---:|
| Candidate 35/35/10/20 | 199/287 | 69.3% |
| Résumé-first 40/40/10/10 | 199/287 | 69.3% |
| Poll-heavy 30/30/10/30 | 197/287 | 68.6% |
| W30/P25 sensitivity | 197/287 | 68.6% |
| W40/P15 sensitivity | 199/287 | 69.3% |
| R30/P25 sensitivity | 198/287 | 69.0% |
| R40/P15 sensitivity | 199/287 | 69.3% |

Controls use exactly matched non-tied game subsets: Colley 203/287 versus candidate 199/287; raw win percentage 180/250 versus candidate 179/250; published-poll anchor 60/74 versus candidate 60/74. Unranked-versus-unranked poll ties are not converted into arbitrary predictions.

These are empirical résumé-order comparisons, **not playoff probabilities or validated CFP selection accuracy**. They do not support declaring the candidate best or adopting permanent weights. Git commit metadata is archival evidence, not a first ESPN publication receipt; historical polls were retrieved later. Repeated teams and a limited season prevent treating outcomes as independent validation of a final playoff field. Original 44-game reconstructed replays remain separately labeled and are not mixed into this aggregate.

Sources: [versioned data repository](https://github.com/sportsdataverse/cfbfastR-data), [example October 19 committed vintage](https://github.com/sportsdataverse/cfbfastR-data/commit/d51c9bdd3493d19b139cce3ea11965b167c56e26). All nine commit IDs, Git blob hashes, historical ESPN URLs, excluded columns and per-window results are recorded in the private validation artifacts. Scripts reproduce the preparation and comparison.

## Actual operational evidence

Read-only Vercel SSO access reached the existing native Upstash consoles. This supersedes the first report’s inability to read fresh meters.

| Resource | Observed result |
|---|---|
| Redis | Approximately 36K / 500K monthly commands; 15 MB / 250 MB storage; $0 cost |
| Complete Saturday Redis commands | 18,739, UTC day |
| Sunday Redis commands | 11,104 at observation; incomplete UTC day, not a daily total |
| QStash installed plan | Free, 500 messages/day in installed Marketplace plan metadata |
| QStash preceding 24 hours | 360 created, 360 delivered, 0 failed |
| Existing scheduler | One active, none paused; every four minutes; retries 0; last state SUCCESS |
| Vercel displayed last-30-day usage | 2,074 invocations; Fluid Active CPU 11m 43s / 4h; provisioned memory 0.56 / 360 GB-hours |

Native meters are rounded and may lag. Vercel’s billing CLI returned cost data unavailable; that was not interpreted as zero. Limits are shared with other relevant account/team usage. No paid changes were made.

A month of the measured Saturday rate would be 562,170 Redis commands before adding the engine. This is a deliberately conservative stress extrapolation, **not a prediction of the actual month**. The original quiet dispatcher simulation is 388,800/month. One hypothetical extra read/check plus 300 additional write commands/day would add 19,800/month, exceeding the 400K safety target even in that quiet extrapolation. A safe production Redis write budget is therefore not established.

The manual local session used three ESPN reads per observation, zero Redis commands and zero QStash deliveries. Candidate session CPU was approximately 1,396 ms including initial persistence and 517 ms on an unchanged repeat; a seven-configuration comparison took about 4,739 ms locally. These measurements exclude source network time and are not measured Vercel engine consumption. Running every alternative at every poll is not the deployment design.

The private engine remains disconnected from production. Before connecting it: validate real busy-week writes, no-op suppression, bounded durable retention across a full season, actual function CPU, and notification latency isolation. Keep both spending and automatic upgrade disabled. Existing native plan metadata confirms Redis automatic upgrade is off.

## Readiness and next decision

**Ready for review:** canonical records; identity-based corrections; local confirmed/provisional engine; immutable replayable snapshots; change-driven shadow ingestion; historical leakage guards and comparisons; published-rule allocation tests; native cost evidence.

**Not ready for public activation:** a definitive projected field, full conference adapters, eligibility coverage, validated proprietary-metric dependencies, full-season retention operations, actual production engine function profiling, or a reliable operational write budget. No live-game source event has occurred during this new private session, so synthetic live-transition tests are not presented as new real-world engine validation.

The next production decision must distinguish a limited, explicitly provisional résumé outlook from a definitive projected field. This report does not recommend replacing the public placeholder or merging PR #19. The 35/35/10/20 formula remains a testing candidate. Public activation and any paid services still require explicit approval.

## Final validation

237 automated tests pass, including prior notification/fresh-fetch regressions and new temporal, rule, archive, eligibility, budget, correction and no-op cases. TypeScript and lint pass. The production build passes. Current-record browser checks pass in Chromium, Firefox and desktop/iPhone-sized WebKit with fixture data and accessibility checks. Notification/browser regressions are simulations, not new real iPhone or desktop push delivery evidence. The prior 59 v1.1 snapshots replay exactly after the archive refactor. The private session holds 14 model snapshots across 3 meaningful input receipts; unchanged observations add neither. Raw/source metadata and exact report files are retained outside the repository.

The existing Watchlist browser test timed out once at its final scroll-position assertion. An isolated rerun with identical assertions and additional failure-only diagnostics passed in Chromium and WebKit. No application change was made to hide that intermittent result; both logs are retained. Desktop notification and favorite-control browser regressions passed with simulated provider/worker APIs.
