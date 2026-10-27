# Live outlook production readiness — Phase 5, October 26, 2026

## Recommendation and minimum launch

Do not activate a definitive 12-team field or statistical playoff probabilities. The smallest honest independent feature is a **current resume analysis**: confirmed records/results, transparent model components, result-linked changes between saved compatible snapshots, and a separate live scenario showing the explicit assumption that a current leader wins. Label that scenario provisional; retain a confirmed baseline. Show published rankings and poll movement separately. Withhold championship qualifiers, field, bracket and seeds wherever required evidence is unresolved. This is an incremental analysis product, not a validated forecast of committee decisions. Even that limited public release still requires explicit approval, operating-budget admission, end-to-end freshness/failure checks and readable methodology. It is not activated by this branch.

Already released records, schedules and team pages remain independent of this experimental model. PR #23 isolates verified mascot names; it is unmerged and undeployed. No new production schedules, services, credentials or notification settings were changed.

## Four distinct validation contracts

| Task | What is scored | Required baseline/evidence | Current conclusion |
| --- | --- | --- | --- |
| Game outcomes | Winner ordering on games not final at input cutoff; ties/coverage reported | Same-game poll, win percentage and independent Colley controls | Prior next-game results are diagnostics, not CFP validation. No probability calibration claim. |
| Playoff selection | Correct 12-team membership, false inclusions and missed selections at fixed pre-selection lead times | Archived as-of inputs; same historical qualification assumptions for candidate and controls; actual official field as outcome labels only | New conditional proxy benchmark; insufficient to approve full qualification/selection forecasts. |
| Seeding | Seed error among correctly selected teams plus a separate missing-team penalty; exact seed, bye and home-game matches | Actual season's rules, distinct from official ranking order (2024 champion byes; 2025 rank-order seeding) | Candidate does not beat poll baseline on latest-window conditional seed error in either season. |
| Movement | Deterministic change versus preceding compatible saved snapshot, attributed to changed results/polls/scenarios; unchanged observations produce no movement | Version-pinned replay, preserved poll editions, no cross-model/mode confusion | Existing replay and event/no-op regressions establish mechanical movement, not that a committee would make the same move. |

Freeze candidate configurations before evaluation. Report every fixed window and baseline, not a selected favorable date. Windows within one season overlap; do not report them as independent seasons or use them to claim statistical significance. Genuine 2026 out-of-sample selection is not available before Selection Day. A credible next gate is a larger archived multi-season corpus with season-held-out comparisons, predeclared lead-time windows and independently verified championship/eligibility handling. Further weights should not be selected by trying to fix one team's miss.

## New selection/seeding experiment

`selection-benchmark.ts` is offline only. Its input identities are verified against the existing Git CSV vintages; final labels never enter the feature computation. Historical poll snapshots retain the existing conservative 24-hour lag. Outcome labels are transcribed from official CFP recaps, with ESPN identities matched to the historical universe:

- https://collegefootballplayoff.com/sports/2025/3/20/cfp-recap-2425
- https://collegefootballplayoff.com/sports/2026/1/27/cfp-recap-2526
- 2024 ranking/format cross-check: https://collegefootballplayoff.com/news/2024/12/8/cfp-rankings-241208

`selectionDay` denotes a conservative UTC start-of-day exclusion boundary, not an exact publication receipt. The actual labels are evaluation targets, not as-of-date source inputs. This is a retrospective experiment with an algorithm written later, not a claim that forecasts were published in those years.

The explicit **champion proxy** chooses the highest-ordered team in each historically eligible conference, then applies five-champion/seven-at-large selection. It has no knowledge of actual future champions, does not certify championship participants, and assumes unresolved historical eligibility. The same proxy is applied to all controls. The 2026 allocator is not reused for 2024/2025. Numeric-ID ordering breaks score ties for reproducibility and does not establish superior evidence among tied teams. These limitations are reasons to keep the benchmark conditional, not silently present its fields as validated qualification.

| Earlier cutoff | Candidate membership | Poll baseline | Colley | Candidate conditional seed MAE | Poll conditional seed MAE |
| --- | --- | --- | --- | --- | --- |
| Dec 7, 2024 09:59Z | 11/12 | 11/12 | 9/12 | 2.82 | 2.45 |
| Dec 6, 2025 17:16Z | 11/12 | 11/12 | 11/12 | 0.55 | 0.36 |
| Nov 30, 2025 07:37Z | 9/12 | 11/12 | 10/12 | See per-window report | See per-window report |

At the November 30, 2025 cutoff, the candidate includes BYU, Notre Dame and North Texas instead of Alabama, Tulane and James Madison. At the last 2024 cutoff all principal variants miss Clemson. The candidate's ranking weights and the simplified future-champion proxy can both cause errors; this experiment does not isolate a single causal weight. Unexpected champions and multiple non-power conference qualifiers expose the championship-projection gap. The candidate's advantage over Colley in the latest 2024 window does not establish superiority to the stronger published-poll baseline. No weight was tuned to these individual misses. Seven frozen candidate/alternative configurations are retained.

## Rules, mandatory inputs and eligibility

The published 2026 CFP format is verified at https://collegefootballplayoff.com/sports/2024/5/29/12-team-format . Championship qualification, independent resume order and bracket allocation are separate operations. Current policy protects the four Power Four champions and the highest-ranked team from the other six leagues; a universal requirement to predict all six other champions would be incorrect.

Pac-12 later-step evidence is now included in the dependency audit. Its specified CFP edition, SportSource team-rating metric and official draw are needed only if preceding criteria do not resolve a tie. SportSource team-success, team-rating and official capped-margin/eligible-win metrics are qualification dependencies for particular conferences, not mandatory new weights in the resume model. Missing official values must not be replaced by model scores. See Phase 4 report for verified sources and adapter details.

Additional current-season Big Ten primary confirmation remains unavailable. The official older summary/scenario links discovered during this review return 404; a third-party carry-forward description does not certify 2026 applicability. Top-two conference records are confirmed, but decisive tied cases remain withheld. ACC mixed eight/nine-game title-pool reference cases and other conference season-applicability gaps remain unresolved. Do not invent an automatic generic tiebreak cascade.

The eligibility audit now combines the existing two institutional receipts with 18 academic-only receipts: all 17 ACC football members and Ohio State. Primary sources:

- https://theacc.com/news/2026/5/5/academic-excellence-acc-student-athletes-continue-to-excel-in-latest-ncaa-apr-report.aspx
- https://news.osu.edu/ohio-state-apr-rates-continue-to-shine/
- https://www.ncaa.org/news/di-cabinet-remands-two-semester-mens-soccer-proposal-to-oversight-committee-for-further-review/

NCAA's adopted 2026 bowl transition change is distinguished from the older proposal and does not by itself certify every reclassifying team's requirements or conference title eligibility. The audit covers all 138 teams and prioritizes a 32-team union of top-30 model alternatives plus conference leaders/Notre Dame for research. Only one of those 32 has universal institutional evidence currently recorded. This research priority set never prunes other potential qualifiers. Academic clearance, six wins, membership and absence of a found ban are not universal certifications. Full eligibility coverage remains blocked; no unresolved team is declared ineligible.

## Measured operations and sustainable design

Nine captured real source inputs were serialized and replayed using the existing compressed snapshot-pair format. Largest raw pair: 287,500 bytes; largest base64 Redis value: 26,476 bytes. A temporary local Redis 7.2.17 process, listening only on a private Unix socket, measured:

- Nine unique stored pairs/index/head: 227,000 bytes of key memory.
- 384 synthetic retention-load keys using the largest real payload: 10,251,264 additional bytes.
- 360 unchanged checks: 360 GETs, zero snapshot writes.
- Stale compare-and-set rejected; current head preserved.
- No production Redis writes, credentials, QStash messages or services involved. Temporary server terminated afterward.

These are production-format serialization and Redis protocol/allocator experiments, not hosted billing/replication or Vercel CPU measurements. The measured maximum local CPU for computing, packing and replay checking a pair was 447.4 ms; repeated every four minutes for 30 days would be about 1.34 local CPU hours, not a Vercel bill or measured function cost.

Proposed bounded design: reuse the existing check's fresh data, read one private head per check, write immutable compressed pairs only when meaningful semantic identity changes, retain at most 384 pairs with TTL and a hard byte/command budget, and serve read-only snapshots without per-visitor recomputation. Maintain a durable reduced baseline before pruning; do not claim indefinite history from bounded retention. A generic sorted-set index must be trimmed along with expiring payloads; TTL alone is insufficient. The five core write operations plus one read/check give a 64,800-command monthly envelope before retention/retries. The admission planner now reserves ten commands per changed pair for bounded-index lookup, payload deletion and CAS retries: 118,800 commands/month if every check changes. Neither figure includes visitor reads or establishes hosted billing. A tighter initial writer budget, for example 20,000 total monthly engine commands including its 10,800 head reads, would permit at most 920 changed pairs under the ten-command reserve. That is a candidate hard cap, not permission to consume the quota; admission must reserve notification/visitor traffic first and stop history writes visibly when exhausted. Actual cleanup and retry billing still must be verified before activation.

Current official Free allowances: 500K Redis commands/month, 250 MB storage, 10 GB bandwidth (https://upstash.com/pricing/redis). Prior same-day native observation was approximately 49K commands, 23 MB storage and $0. Existing four-minute cadence is 360 scheduled checks/day (10,800/30 days); no extra schedule or QStash delivery is proposed. The three complete daily samples range from about 4.9K to 19K Redis commands. Extrapolating the peak every day would already exceed 500K, so low cumulative usage is not proof of a safe monthly budget. A full representative weekly pattern, remaining monthly budget, visitor demand, hosted retries, actual Vercel CPU/memory usage and index cleanup must pass admission before a writer is activated. The budget is an external-observation blocker, not permission to upgrade.

## Artwork and browser investigation

Production team APIs and actual image requests were checked for Tennessee, Florida, Michigan, Montana State and Auburn. All supplied school logos returned HTTP 200 PNGs. Tennessee and Montana State logos decoded to 500×500 in Chromium desktop and iPhone-sized WebKit. Mascot names remain null in production ESPN profile data; the isolated PR #23 fixes verified names, not character artwork. No mascot illustration is supplied or inferred. No artwork fix is bundled into PR #19. A separate mobile overflow was reproduced on Montana State: a large Unavailable record label produced 422px content on a 390px viewport. A bounded, wrapping responsive record label is prepared on the existing isolated PR #23 branch; missing-record fixtures pass Chromium/WebKit at 320/390/430/844px. This CSS change is excluded from PR #19 and has not been deployed.

The Watchlist harness now supports isolated engine selection and optional Playwright traces, captures button geometry/readiness on failures, and closes browsers in a finally block. It does not force clicks, remove stability assertions or silently change scrolling behavior. Two isolated, traced WebKit reruns pass unchanged application behavior. Passing reruns do not establish that the earlier intermittent WebKit timeout is fixed.

Final engine regression run: 280 tests pass; lint and type checks pass. Both engine and isolated mascot builds pass. Public alert routes, service worker, credentials, preferences and polling configuration have no changes in this phase.
