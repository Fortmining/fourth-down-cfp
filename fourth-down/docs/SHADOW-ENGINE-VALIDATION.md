# Shadow engine validation — October 25, 2026

This is the first validation pass. See [the resumed development report](SHADOW-ENGINE-PHASE2.md) for subsequent rule adapters, actual native meters, historical vintages and integration results.

**Recommendation: keep public projections inactive.** The candidate engine, canonical-record foundation and reproducible local archive are implemented and tested on `dev/v0.8.6-live-outlook`. No production engine, additional scheduler, paid service or Redis writer has been activated. Record-view changes are staged for review, not published to the main site.

## What is implemented

- A season/team/game-ID data foundation, recursively parsed conference membership and a deduplicated regular-season ledger. Finals require completed state, valid scores and an unambiguous winner. Corrected game IDs replace prior outcomes; old observations cannot overwrite newer ones.
- Canonical records computed from confirmed game IDs and reconciled against provider overall/conference totals. Separate provider-backed current-record joins for the development UI and independent outlook aliases, preserving `polls[].teams[].record`, ranks, prior ranks and publication dates. Aliases retain `publishedRecord` and their current-record observation time. Conflicting totals are withheld rather than guessed.
- Versioned `resume-shadow-v1.1.0` calculations for the 35/35/10/20 testing candidate, resume-first and poll-heavy variants, and four ±5-point perturbations. Confirmed and “if leads hold” scenarios are separate; no live assumptions modify real records.
- A separate Colley-style, FBS-only results control. It is our recomputation, not the author’s published rankings and not a probability model.
- Immutable, content-addressed local archives with exact input/model/rules versions. Observation metadata is separate from game facts, so a refreshed observation does not duplicate unchanged results. The archive enforces a 32 KiB snapshot limit, 64 MiB total limit and 768-snapshot cap. It stops new archival writes at a cap rather than silently rewrite history. No production Redis adapter is enabled.

## Real-source reconciliation

Source capture epoch: 2026-10-25T14:29:10.805Z (UTC). These are observed ESPN inputs; they are not a historical as-of forecast.

| Check | Result |
|---|---:|
| Teams in recursive standings | 138 |
| Known-participant scheduled games | 888 |
| Pending future fixtures (unassigned opponents) | 14 |
| Total season schedule entries | 902 |
| Games marked Final | 566 |
| Overall/conference record reconciliation conflicts | 0 |
| Complete-source bootstrap requests | 18 |
| Archived candidate snapshots | 59 |
| Candidate snapshots restored/recomputed exactly | 59 |
| Archive including normalized inputs | 3,035,289 bytes |
| Largest compact snapshot | 15,307 bytes |

The development API was also checked against every current AP team: all 25 match the independently captured season totals while publication records remain intact. Tennessee reconciles to **6–2 overall and 3–2 in conference**, while its October 18 AP snapshot retains **6–1 and No. 11**. All 138 source-team records, including all 25 AP teams, reconcile with the captured season ledger. Membership coverage is not an eligibility certification.

### Source/caching defects caught during validation

1. `limit=1000` returned only 25 ESPN events per week. The verified `limit=150` request returned the complete observed schedule. Returned week/season and provider record totals are checked; incomplete coverage or record conflicts block a definitive field. The incomplete first bootstrap is not used in the reported comparisons.
2. The attempted raw standings fetch-cache entry was 3,451,864 bytes, above Next.js’s 2 MB item limit. The new lookup fetches that body without trying to cache it and caches only normalized team totals/observation metadata for 60 seconds. It is skipped entirely by scheduled alert checks.
3. Future-game pregame records must not overwrite a newer completed-game total. Missing, stale or conflicting source totals are explicitly handled.
4. Four Pac-12 flex fixtures and ten conference-title fixtures have unassigned future participants. These 14 entries are preserved separately; negative ESPN placeholder IDs never become teams. Remaining-schedule difficulty is withheld while those opponents are unresolved. Confirmed-record coverage is complete, but future-opponent coverage is not.
5. Offline runs preserve original capture times; they do not relabel old source data as freshly fetched. Source capture times are not ESPN first-publication times.

Local feed check: 2091 ms cold versus 331 ms warm; cached record observation timestamp reused: **True**. This is a local measurement, not a production latency guarantee.

## Model comparisons

These are **top-12 resume lists**, not a selected CFP field. Qualification is still withheld. Position differences below cover all 138 teams, not only the top 12.

| Configuration | New top-12 resume entries vs candidate | Maximum position difference |
|---|---|---:|
| candidate-35-35-10-20 | None | 0 |
| resume-first-40-40-10-10 | James Madison Dukes | 8 |
| poll-heavy-30-30-10-30 | Alabama Crimson Tide | 6 |
| sensitivity-W30-P25 | Alabama Crimson Tide | 4 |
| sensitivity-W40-P15 | None | 4 |
| sensitivity-R30-P25 | Alabama Crimson Tide | 3 |
| sensitivity-R40-P15 | None | 4 |
| Colley-style FBS-only control | Texas Longhorns, Alabama Crimson Tide, LSU Tigers | 33 |

The resume-first variant admits James Madison where the candidate does not; the poll-heavy variant admits Alabama instead of Wake Forest. Even five-point shifts change a top-12 entry. The separate matrix control differs further: it has no poll anchor and excludes FCS games. These comparisons demonstrate sensitivity, not which model is correct.
The matrix control used 444 FBS-versus-FBS finals and explicitly excluded 122 FCS-involving games. Its largest linear-system residual was 7.11e-15. A small numerical residual validates the solve, not predictive accuracy. Canonical actual records still include FCS outcomes.

Method reference: [Colley original method](https://www.colleyrankings.com/matrate.pdf).

## Replays and explainability

Replayed **44** October 24 Eastern-date completed games in scheduled-start order, using revised currently captured inputs. This is a functional reconstruction, not the order in which finals were originally reported and not a leak-free historical prediction backtest. No pre-existing model history is invented.

| Inserted result | Participant resume change within reconstructed sequence | Other teams with score or position changes |
|---|---|---:|
| 401856731 | Tennessee Volunteers: 12 → 17 (-6.466 points); South Carolina Gamecocks: 80 → 64 (+5.062 points) | 34 |
| 401856729 | Kentucky Wildcats: 11 → 11 (+0.765 points); Vanderbilt Commodores: 102 → 109 (-2.558 points) | 21 |
| 401856732 | Ole Miss Rebels: 9 → 13 (-7.168 points); Texas Longhorns: 25 → 21 (+3.040 points) | 21 |

The Tennessee-loss insertion produces changes for teams not playing because opponent strengths and the complete order are rebuilt. Live lead reversals, ties, stale data, premature periods and replacement by a final are exercised with synthetic fixtures. No new real live-game engine delivery or visible phone banner is claimed. Official poll movement remains a separate published-edition comparison.

## Qualification, eligibility and seeding

Implemented allocation mechanics are tested in fixtures: reserve the four Power Four champions and the highest-ranked six-conference representative (not necessarily a champion), protect Notre Dame when its projected eligible selection position is within 12, fill at-large places, then seed; exclude ineligible teams before evaluating the top-12 condition. Test qualifiers below 12, first-round byes, hosting pairs and unresolved inputs. All outputs remain marked shadow/non-definitive.

Activation blockers:

- Complete, season-versioned ACC/Big Ten/Big 12/SEC championship/tiebreaker adapters have not been verified and implemented. The ACC changed its policy for unequal 2026 schedules. The available Big 12 page is labeled 2025 and refers to SportSource Analytics; that is not proof of a fully verified 2026 adapter. Proprietary metrics, unresolved draws and unavailable rules must remain unresolved, not replaced by a model ID sort.
- Team eligibility is deliberately unknown until verified; no school is automatically declared ineligible from transition status. NCAA changed reclassifying teams’ bowl-participation rules effective in 2026, so an old blanket transition ban would be wrong. The remaining institutional requirements and CFP-specific treatment still need a sourced registry.
- Championship-path forecasting is not activated. No title-game representative or champion is fabricated to make a twelve-team list. The field is withheld rather than treating the top twelve resume scores as the playoff field.
- Fourteen future fixtures still have unassigned participants. Remaining-schedule difficulty is unavailable rather than computed from a misleading partial opponent set.
- Genuine historical, as-of input vintages and later committee outcomes are needed before claiming predictive validation or accepting a permanent weighting.

Primary sources: [CFP format](https://collegefootballplayoff.com/sports/2024/5/29/12-team-format), [CFP protocol](https://collegefootballplayoff.com/sports/2016/10/24/selection-committee-protocol), [2026 ACC update](https://admin.theacc.com/news/2026/7/15/acc-announces-new-football-championship-tiebreaker-policy.aspx), [Big 12 policy page](https://big12sports.com/sports/2024/9/6/FB_0906243427.aspx?path=football), [NCAA June 2026 participation rule](https://www.ncaa.org/news/di-cabinet-remands-two-semester-mens-soccer-proposal-to-oversight-committee-for-further-review/).

## Operational cost profile

| Resource | Measured or bounded result |
|---|---|
| Shadow engine Redis commands | 0; local files only |
| Additional QStash schedules/deliveries | 0; no scheduler activation |
| Production engine function invocations | 0; engine not connected to production |
| Local candidate confirmed+provisional CPU | Median 300.8 ms; p95 386.1 ms |
| CPU illustration at 10,800 runs/30 days | 0.90 CPU-hours, excluding ingestion/network/persistence; not measured on Vercel |
| Archived normalized model/input storage | 3.04 MB; hard cap 64 MiB |

Existing dispatcher command profiling was repeated in memory with no real network writes: **36 commands** for a quiet fixture, **116** with five score changes, **296** with twenty. At 360 checks/day, a 30-day quiet-case extrapolation alone is **388,800** commands. Adding five commands each check would add **54,000**, reaching **442,800 before busy events or readers**. Neither figure is an actual monthly bill; it demonstrates why a new unprofiled persistence loop is unsafe. The proposal’s 80%-of-free allowance guard is 400,000 commands.

Published limits checked: Redis Free 500K commands/month and 256 MB standard storage; prior native console showed approximately 250 MB. QStash public Free limit is 1,000 attempts/day; an older installed Marketplace description showed 500. The unchanged four-minute job is 360 ordinary attempts/day, below either, before any retries. Vercel Hobby lists 4 CPU-hours and one million invocations. The local CPU illustration does not establish actual Vercel headroom.

The native Upstash browser session required Vercel sign-in, so a refreshed account billing/command meter was not obtained. Earlier rounded dashboard use is not presented as current usage. No paid upgrade or new credentials were requested. Before enabling persistence: measure an actual busy-day command budget, reduce/reuse redundant placeholder writes, validate bounded atomic storage, and profile the real Vercel function.

Sources: [Redis pricing](https://upstash.com/pricing/redis), [QStash pricing and delivery-attempt accounting](https://upstash.com/pricing/qstash), [Vercel limits](https://vercel.com/docs/limits).

## Verification and production recommendation

217 automated tests pass, including all existing push and fresh-feed regressions plus the new ledger, record, archive, live, qualification and matrix-control cases. The production build, lint and TypeScript checks pass. Current-record browser checks cover Chromium, Firefox and WebKit desktops plus an iPhone-sized WebKit viewport. Existing favorite, preset, Watchlist and desktop-push regressions use simulated APIs/workers. They are not new real-device push evidence.

**Do not activate public projections yet.** Keep the model in shadow mode. The provider-backed current-record view can be reviewed/released separately; completing the qualification/eligibility registry, historical as-of validation and real operational budget comes before any definitive field. Production polling, push preferences, v0.8.4 fresh fetching and the hourly latency monitor are unchanged.
