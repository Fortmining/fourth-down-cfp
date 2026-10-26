# Phase 3 — records release candidate and private engine validation

October 25, 2026 (EDT). **Recommendation: release the records-only correction after approval; keep PR #19 in draft and the projection engine private.** Security remediation is closed: the coordinated credential rotation and ordinary 8:48 PM EDT scheduler run were verified separately. No credential is included here.

## Current records: independently releasable

The original public outlook consumed the win-loss record embedded in a published poll. The first foundation joined current standings, but could only withhold a conflicting total when standings lagged a new Final. This pass adds a verified season-results ledger to the display path. Current records no longer depend on a new poll publication or the independent projection formula.

- Prior regular-season weeks are fetched by explicit ESPN season/week, normalized and cached for 15 minutes. An attempted year-range query returned only 25 events, so it is deliberately not used as a complete ledger.
- Current-scoreboard verified Finals overlay the cached ledger by season/game identity. A correction replaces that game; a temporary live/scheduled regression cannot erase a verified Final. Live leads never increment actual records. Malformed, incomplete and future Finals do not count.
- Overall and conference records are separate. Conference-title results do not increment regular-season conference standings; Pac-12 flex games are excluded as specified by the conference. Unknown/conflicting totals are withheld, with transparent fallback to supplied provider records if the historical source fails. An empty ledger does not manufacture 0–0.
- Rankings, Home, the existing outlook, team/game details and Watchlist use the same current-record map. A saved recent Watchlist result joins today's record instead of displaying its archived record as current. Official ranking positions, publication records, dates and poll-movement comparisons remain intact.
- Public visitors retain the existing 60-second score/ranking cache and HTTP stale-while-revalidate policy. The records cache is separate; its old-week source reads share a five-second deadline and bounded concurrency. Standings and ledger reads start in parallel. Source delay and website caching still limit how quickly a newly reported Final becomes visible; this is not a subsecond update promise.
- The notification dispatcher does not invoke this lookup. Its no-store fetch behavior, four-minute schedule, rotated credential, subscriptions, categories, cooldowns and deduplication remain untouched.

### Real source audit

The October 25, 8:53 PM EDT capture contains 510 prior-week Finals and 56 current-week Finals. All **138 FBS teams** reconcile exactly with current ESPN overall **and** conference standings: zero mismatches. Both the AP Top 25 (October 18 edition) and Coaches Top 25 (October 25 edition) have current records available for every ranked team. Tennessee is **6–2 overall, 3–2 conference**. Source bodies and hashes are retained privately. This verifies current source data; no new live-to-final production transition occurred during this pass.

A records-only patch was assembled against the exact production commit `5ce9b96ea5af765ef97f8490c3a50e378f844889`, then tested and built in an isolated validation checkout. It excludes the engine, qualification allocator, shadow sessions, model sensitivity and storage transport. Its tree is `e77c5ffe522384bbea53a2dc3de1479c46032f6c`; the patch/evidence are retained outside the repository. This is a deployment candidate, not a production release or another project. PR #19 need not be merged to release it.

## Qualification and eligibility

The [CFP's current format](https://collegefootballplayoff.com/sports/2024/5/29/12-team-format) and [selection protocol](https://collegefootballplayoff.com/sports/2016/10/24/selection-committee-protocol) remain the authoritative allocation/seeding sources. Independent résumé order is not a committee ranking. Automatic/protected berths precede at-large allocation. No public field or probabilities are activated.

The [Big Ten's 2026 championship publication](https://bigten.org/news/2026/8/19/championship-2026-discover-big-ten-football-championship-game-information.aspx) verifies qualification by the best conference records. A new season-scoped adapter can resolve unambiguous terminal participants, while tied qualification requiring the full policy is explicitly withheld. Searches of current conference and member-school publications did not establish a primary-source confirmation of the complete older procedure's 2026 applicability. Third-party assurances are not treated as that confirmation. The older carry-forward adapter remains explicitly unverified.

ACC/Big 12/SEC adapters and their previously tested branches remain. Mixed ACC alternate-schedule groups still require authoritative reference cases. Full other-conference title adapters are not completed. The Pac-12's [published 2026 procedure](https://pac-12.com/news/2026/9/3/pac-12-announces-commercial-and-operational-updates-ahead-of-its-2026-football-season-kickoff.aspx) is distinct from generic cascades; it must not be replaced with another conference's procedure. These are explicit activation gates, not claims of completion.

Official SportSource metrics are **conditional tiebreaker dependencies**, reached only if earlier criteria fail. They are not universal required inputs or additional weights in the independent résumé model. `requiredEvidence` identifies missing dependencies without substituting a model score or drawing a synthetic coin toss. Confirmed championship context requires a verified title-game Final and institutional eligibility, not a ranked regular-season leader.

The NCAA public APR service returned 261 football rows. The [university's March announcement](https://gozips.com/news/2026/3/4/akron-football-bowl-eligible-for-2026-practice-restrictions-lifted) confirms Akron's NCAA waiver and 2026 postseason eligibility despite its below-benchmark APR. That evidence joins NDSU in the strict institutional registry: **2 verified, 136 unresolved**, not 136 ineligible. Academic, transition and institutional evidence now have distinct scopes; an academic score alone cannot certify full eligibility. The [NCAA's APR guidance](https://www.ncaa.org/what-we-do/research/academic-progress-rate/) and [2026 transition legislation](https://web3.ncaa.org/lsdbi/search/proposalView?id=109240) do not certify every institution's compliance or resolve every other restriction. Broader eligibility clearance remains a real evidence blocker.

## Model and historical validation

The 35/35/10/20 candidate and six alternatives remain frozen testing configurations. No team-specific tuning or new public formula was introduced. New sensitivity output reports each team's minimum/maximum résumé position across all seven models; this is not a playoff probability or definitive field. An earlier captured input had four teams whose top-12 résumé membership changed across configurations; the latest captured input has none. Sensitivity is tied to each exact input hash and poll baseline, not assumed constant. Confirmed and provisional snapshots remain separate.

The source-pinned comparison now includes an additional 2024 season, prepared from genuine then-committed ledgers and conservatively lagged historical poll editions. No present-day records, later winners or postgame ratings enter earlier forecasts. Each Git blob is verified. Qualification is disabled in historical résumé experiments so 2026 rules do not leak into 2024/2025.

| Complete-input common outcomes | Candidate | Colley control | Résumé-first | Poll-heavy |
| --- | --- | --- | --- | --- |
| 2025 | 199/287 | 203/287 | 199/287 | 197/287 |
| 2024 | 79/121 | 77/121 | 76/121 | 79/121 |

In the 14 candidate/Colley disagreements in 2025, Colley wins nine and the candidate five. In six disagreements in 2024, the candidate wins four and Colley two. This does not establish a stable superior model. Outcomes reuse teams, are not independent trials, and measure next-game résumé-order agreement rather than CFP selection accuracy. Weights remain unapproved for permanent production use.

One 2024 vintage has an official 26-team tied AP edition unsupported by the frozen model's 25-row anchor validator. The whole vintage is explicitly excluded; no team or historical rank is removed. Another 2024 input vintage has missing archived Final scores and is excluded from aggregate results, as are the previously documented incomplete 2025 vintages. These exclusions and source identities are retained. Missing historical captures are never backfilled as forecasts.

Repeated full-ledger sorting was removed from `currentRecords`. Five local same-input measurements reduced record-calculation CPU from a warm roughly 48 ms to roughly 5 ms; all records are identical. **All original 59 v1.1 snapshots replay exactly.** Local full candidate confirmed/provisional pairs used approximately 101–184 ms CPU. These are local measurements, not measured Vercel function consumption.

## Storage, writes and service limits

The new compressed-pair dry-run format replays exactly and installs no Redis transport. A current receipt uses approximately 26.7 KB after base64 encoding (about 250.7 KB raw). A 64 MiB reserve holds roughly 2,500 such measured pairs before index/allocator overhead. This does not remove the existing local archive's protective 768-snapshot cap or establish unlimited season retention.

The existing Redis installation was rechecked as Free, 500K monthly commands, automatic upgrade disabled. Earlier native meters remain the usage evidence: roughly 36K commands and 15 MB used at observation, and 18,739 commands on the complete Saturday. QStash remains one four-minute schedule; the installed allowance is 500/day and the prior measured day had 360 deliveries. No plans, polling or spending changed.

Dry-run write accounting reserves five commands per meaningful pair, conservatively including immutable storage/index/CAS operations. An additional read at every existing check alone costs 10,800 commands per 30 days. The illustrative 36K-used + 360K-reserved scenario leaves only 4K commands below the 80% threshold, before those reads. It is **not a newly measured safe allocation**. Actual billing, contention/retries, representative weekly traffic and retention overhead remain unmeasured; no production writer is authorized by this calculation.

Vercel's read-only detailed CPU query returned `payment_required`: Observability Plus is required. No upgrade was made. Local profiling and earlier free native meters are distinguished from unavailable production CPU measurements. The records-only release adds **zero Redis writes, zero QStash deliveries and zero schedules**; the engine remains private until its operating budget is established.

## Regressions and release decision

The full branch passes 252 automated tests; the isolated records-only packet passes 201. Both production builds pass; branch type checks and lint pass. Browser fixtures cover Chromium/Firefox/WebKit current-record views and iPhone-sized WebKit, plus notification settings, permanent favorites, desktop push, Watchlist, safe areas, persistence, accessibility, failed saves and retries. These push/browser checks are simulations, not new physical-device delivery confirmation.

The Watchlist failure was reproduced with `#watchlist` selected but scroll position near Games, while 175 cards put Watchlist approximately 57K pixels below the viewport. In-page navigation now explicitly re-anchors even when the hash is already selected; modifier clicks and existing unsaved-change capture guards are preserved. A separate initial test assertion now waits for the independently rendered completed card before comparing all three expected cards. Assertions are unchanged; failure diagnostics are retained. Chromium and WebKit pass after the fixes.

**Next approval:** deploy only the validated records/Watchlist packet to the existing project. Do not merge PR #19 or activate projections. The projection field remains blocked by current full Big Ten tie-policy confirmation, outstanding conference branches and required metric feeds, institutional eligibility coverage, selection-model validation and a measured sustainable production persistence budget. Existing hourly latency monitoring stays separate.
