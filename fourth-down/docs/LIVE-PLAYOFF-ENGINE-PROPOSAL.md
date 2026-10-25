# Fourth Down: live playoff engine audit and proposal

**Status: proposed for review; no projection model approved, implemented or deployed.**

Audit date: October 25, 2026. Repository base: `5ce9b96ea5af765ef97f8490c3a50e378f844889`. Work branch: `dev/v0.8.6-live-outlook`. This document supersedes treating the problem as only a weekly poll or display-cache issue.

## Recommendation

Build a deterministic, résumé-based independent selection order, a separate CFP rules allocator, and a clearly separate “if current leads hold” live scenario. Keep current records and official polls in different datasets. Save meaningful, reproducible snapshots before presenting model movement.

The weights below are a concrete proposal, not established football truth or an approved algorithm. Validate them in shadow mode and sensitivity tests before publishing a field. No playoff percentages, proprietary ESPN strength-of-record claims, or unofficial changes to published poll ranks.

## 1. Confirmed root cause and production evidence

There are two defects in the product architecture:

1. `app/lib/rankings.ts` maps `recordSummary` from each published poll into `Ranked.record`. `app/lib/live-feed.ts` then assigns the selected poll’s teams directly to `rankings` and `outlook.teams`. The outlook therefore inherits publication-time records. No current-record join occurs.
2. `app/lib/model.ts` defines fixed tiers solely from published rank. `outlook-snapshots.ts` stores rank/tier arrays with `predictive:false`. Its comparison requires a newer poll edition; it has no game-result, live-state, schedule-strength or qualification inputs. The dispatcher holds same-edition rank corrections and retains ten edition snapshots. This is a poll illustration, not a live playoff engine. A record-only fix cannot create an engine.

Production `/api/live` simultaneously returned Tennessee at **6–1, AP No. 11, publication October 18**, and its completed South Carolina game with Tennessee **6–2**. ESPN’s current team endpoint also returned **6–2**; conference standings returned **3–2 in conference**. The source data exists; the outlook reads the wrong record dataset.

All 25 AP teams were checked against individual current ESPN team records: **19 differ; six match**. The full table follows in section 11. This is observed source data, not a simulated model output.

### Surface audit

| Surface | Existing source/behavior | Required separation |
|---|---|---|
| Home/outlook cards and contender list | `data.rankings[].record`, sourced from the selected poll | Current record keyed by season/team ID; independent model rank |
| Published Rankings | `selectedPoll.teams[].record` | Preserve publication record in the snapshot; display explicitly labeled current record separately |
| Poll movement arrows | `previous - rank` in published data | Keep exactly this meaning; never use result-driven movement here |
| Games and team detail game cards | Competitor `records[type=total]` from available games | Join one canonical current-record store; optionally expose game-time record with that explicit label |
| Team detail | Current-week plus two future schedule periods; published poll positions | Add canonical overall/conference record and separate publication/current timestamps |
| Watchlist | Shared game feed; generally displays scores/status rather than overall record | Any record displayed must come from the same canonical store; no separate recalculation |
| Playoff bracket illustration | Hard-coded poll-rank matchups/top-12 illustration | Replace with independent selection order → qualification → seeding, after approval |
| `/api/pulse/model` | Explicitly unsupported predictions; poll-only snapshots | New versioned model read API; do not silently enable model alerts |

## 2. Available inputs and missing infrastructure

Observed ESPN endpoints (public but undocumented; availability is not a contractual guarantee):

| Input | Observed source | Availability / caveat |
|---|---|---|
| AP, Coaches, CFP editions | `site.api.espn.com/apis/site/v2/sports/football/college-football/rankings` | Publication dates, ranks, previous ranks, edition records; CFP is not yet published for 2026 |
| Live scoreboard | Same base, `scoreboard?groups=80&limit=150` | State, period, clock, scores, completion, winner, competitor records; current week, not season history |
| Team records | Same base, `teams/{teamId}` | Tennessee verified overall 6–2; structured totals and conference group ID |
| Full team schedule | Same base, `teams/{teamId}/schedule?season=2026` | Tennessee verified 12 regular-season events, eight marked completed; source timestamp supplied |
| Conference standings | `site.api.espn.com/apis/v2/sports/football/college-football/standings?season=2026` | 11 top-level groups including independents; recursively 138 unique teams in this response |
| Membership | Standings tree plus team metadata | Sun Belt has two nested divisions; a flat parser omits 14 teams. Count is observed ESPN coverage, not a verified list of CFP-eligible schools |
| All-team directory | Same site-v2 base, `teams?groups=80&limit=1000` | Returned **762 teams**, not an FBS-only roster. Do not trust that query parameter as a membership filter |
| Head-to-head/common opponents | Reconstructed from verified season game ledger | Available in principle; no existing complete ledger |
| Schedule/record strength | Derived transparently from that ledger | Not currently implemented; ESPN SOR/FPI access/meaning/coverage not verified and not assumed |
| Conference champions and tiebreakers | Official conference rules/results | Requires season-versioned adapters; membership alone does not identify a champion |
| CFP eligibility | Official season-specific eligibility information | Must be checked separately; do not infer eligibility from ESPN membership |

The sample schedule did not expose a simple `conferenceCompetition` flag. Classify conference games using verified, season-specific membership and rules, not names or an assumed flag. Account for non-counting games/exceptions explicitly.

Existing caches: public source fetches revalidate after 60 seconds; `/api/live` advertises 60-second shared caching plus 120-second stale-while-revalidate. The page refreshes while visible every minute. Assembly time is not source publication time. Notification checks explicitly use fresh current scoreboard/rankings (`no-store`) every four minutes. Preserve that path.

## 3. Verified 2026 CFP selection and seeding rules

As verified October 25 against CFP’s current format and protocol pages:

- Twelve places: the ACC, Big Ten, Big 12 and SEC champions; the highest-ranked team from the American, CUSA, MAC, Mountain West, Pac-12 or Sun Belt; seven remaining selections.
- The six-conference qualifier need not be a conference champion.
- Notre Dame has protection when ranked in the final CFP top 12, reducing the remaining at-large allocation to six.
- First-round byes go to seeds 1–4. Seeds 5–8 host 12–9 respectively. Automatic qualifiers below the selection top 12 go at the bottom in selection order. Unranked qualifiers still require relative evaluation. No reseeding.

The independent projected order must be labeled Fourth Down’s assessment. Only the committee can establish actual CFP ranks and final selections. In midseason, replacing an official rank with a model rank for a qualification scenario is an explicit projection assumption, never a claim the official condition has been met.

Sources: [CFP format](https://collegefootballplayoff.com/sports/2024/5/29/12-team-format), [CFP protocol](https://collegefootballplayoff.com/sports/2016/10/24/selection-committee-protocol), [2026–27 continuation announcement](https://collegefootballplayoff.com/news/2026/1/23/2627-format).

### Conference implications and verification limits

The conference championship winner, not a current standings leader, supplies each Power Four automatic place. Midseason projected representatives are conditional. Preserve distinctions between leader, projected title-game participant, projected champion, and confirmed champion.

The ACC announced a **new 2026 policy**, including unequal conference schedules; a generic winning-percentage sort or old divisional policy is insufficient. Its current notice and policy are identified. The Big Ten’s 2026 page confirms two qualifying teams from conference play, with tiebreakers. The SEC’s dedicated tiebreaker entry point was identified but its embedded PDF text was unavailable through the text fetch. The Big 12’s available policy page explicitly says **2025** and includes an external analytic-rating step and coin toss. It is not sufficient evidence to claim the entire 2026 adapter is verified.

**Implementation gate:** obtain and version the applicable complete 2026 Power Four tiebreaker policies before presenting a resolved projected field. If a rule needs an unavailable proprietary rating, an official draw or an unannounced decision, retain the tied candidate set and show field alternatives/unresolved qualification. Never replace an official tiebreaker with an arbitrary team ID or our model score. Six-conference title outcomes may change their résumés but are not themselves prerequisites for that group's CFP bid.

Sources: [2026 ACC announcement](https://admin.theacc.com/news/2026/7/15/acc-announces-new-football-championship-tiebreaker-policy.aspx), [ACC policy](https://theacc.com/documents/2026/7/15/ACC_Football_Tiebreaker_Policy_Jully_2026.pdf), [2026 Big Ten championship](https://bigten.org/news/2026/8/19/championship-2026-discover-big-ten-football-championship-game-information.aspx), [SEC rule entry point](https://www.secsports.com/fbtiebreaker), [Big 12 page—2025 label](https://big12sports.com/sports/2024/9/6/FB_0906243427.aspx?path=football).

## 4. Proposed deterministic selection methodology

### Scope and score

Evaluate the complete verified eligible FBS universe, not only ranked teams. Preserve FCS results in actual overall records, but do not assign FCS opponents invented FBS ratings.

Proposed current-résumé score, on a 0–100 scale:

`Score = 35 × W + 35 × R + 10 × S + 20 × P`

| Factor | Definition | Weight / reason |
|---|---|---|
| Overall performance `W` | `(wins + 0.5 × ties) / completed games`, from confirmed results/current records | 35%; actual results should dominate reputation |
| Opponent-adjusted résumé `R` | Result quality calculation below | 35%; credit strong wins, penalize weaker losses |
| Played-schedule strength `S` | Mean eligible FBS opponent winning fraction, excluding games against the evaluated team | 10%; distinguish schedules without using victory margin |
| Published baseline `P` | CFP edition once available; before then 75% AP + 25% Coaches rank score | 20%; useful reference, insufficient to prevent results-driven movement |
| Quality wins/losses | Included in `R`, with individual contribution explanations | No second bonus; avoids counting the same evidence a third time |
| Head-to-head/common opponents | Selection-score tie resolution below; always shown | Not a universal override of an entire season |
| Conference record/championship | Actual record + separate qualification adapter | No cross-conference win-percentage bonus |
| Remaining difficulty | Mean remaining opponents’ current strength, with schedule coverage | 0% earned-résumé bonus; affects forward-path/championship scenarios, not credit for unplayed games |

For an FBS opponent, define `q = (opponent wins excluding our games + 1) / (opponent completed games excluding our games + 2)`. This is a disclosed neutral smoothing prior for the model only, not a fabricated win or loss in anyone’s displayed record. Confirmed ties count half. Excluding head-to-head results prevents directly rewarding a team for having given its opponent a loss.

For each confirmed FBS game, contribution is `0.5 + 0.5q` for a win and `−(1 − 0.5q)` for a loss; a tie contributes zero. For a verified FCS game, proposal uses +0.25 for a win and −1 for a loss as an explicit policy, not an inferred FCS rating. `R = (mean contribution + 1) / 2`. `S` excludes FCS opponents; show FCS counts separately. Teams with no confirmed eligible FBS opponents do not receive a normal comparable SOS score; show insufficient résumé rather than fabricate one.

`P(rank) = (26 − rank) / 25` for ranks 1–25; a team explicitly outside that published top 25 receives zero. A missing edition is not the same as unranked. If only AP or Coaches is available before the first CFP release, use the available poll and label the substitution. Once CFP is published, use CFP for `P`; AP/Coaches remain context rather than averaging away the committee baseline. Keep the last valid dated CFP edition when a newer one is temporarily unavailable; after eight days, flag an expired anchor and retain the last valid field as stale rather than silently substituting AP. Missing all baseline data prevents normal anchored publication.

**Tradeoffs for approval:** these factors are correlated, and 35/35/10/20 is a proposed editorial weighting, not a calibrated imitation of committee voting. Wins and opponent quality can move every competitor’s schedule/résumé score; this captures indirect upset effects. Test weight sensitivity ±5 percentage points and compare reasonable alternatives before activation. Do not tune weights to force Tennessee or any named team into/out of the field. No margin-of-victory or injury adjustment is proposed without a separately reviewed source/model.

### Deterministic tie resolution

Compare unrounded component values at a specified fixed precision. For an exactly tied group: use a complete head-to-head mini-league, or an undefeated head-to-head winner over all tied teams; otherwise skip incomplete/cyclic comparisons. Then compare record against the common eligible opponent set when nonempty, overall winning fraction, baseline published rank, and finally numeric team ID as a stable display ordering with “model tie” disclosed. The last step is never an official qualification or championship tiebreaker.

### Projected field versus selection order

1. Produce the full independent current-résumé selection order.
2. Identify actual Power Four champions when confirmed. Before confirmation, create explicit conditional championship scenarios.
3. For a default forward path, project remaining regular-season winners using the **frozen current-résumé ordering for that run**. This is deterministic, not a probability or a claim future scores exist. Higher ordered team wins that scenario; exact model ties produce alternative branches rather than invented certainty. Apply verified conference standings and tiebreakers, then use that frozen order for the hypothetical title-game result. Do not feed hypothetical wins back into actual records or recursively re-rate until a desired result appears.
4. Reserve Power Four places and the highest independent-ordered eligible six-conference team. Apply a separately labeled projected Notre Dame condition. Fill the remaining allocation by independent order, deduplicating teams.
5. Seed selected teams in that order with out-of-top-12 qualifiers at the bottom; apply the published bracket rules. Selection rank, qualification reason and bracket seed are separate fields.

This is a current-résumé selection projection with conditional championship paths, **not a calibrated end-of-season forecast**. Remaining schedule difficulty is visible and affects the conference path calculation; an easier unplayed schedule earns no résumé points. If a title path or eligibility is unresolved, show alternate occupants/ranges rather than silently claiming an exact 12-team field. A complete end-of-season performance model would be a separate reviewed extension.

## 5. Confirmed and live provisional recalculation

Maintain two model layers:

- **Confirmed:** only verified completed games enter actual records and résumé scoring. A valid new final updates the ledger once by event ID, then recalculates all affected opponent strengths and the entire order/field.
- **Live provisional:** a separate “if current leads hold” scenario adds each valid in-progress leader as a hypothetical winner. Recalculate the whole field, including teams not playing. Tied games have no assumed main outcome; show win/lose alternatives. No invented win probability, final result, clock, score or expected margin.

Show period, clock, observed score and source age next to each scenario; first-quarter assumptions are visibly provisional. A score/leader/period change can trigger recomputation even if the resulting rank is unchanged. Do not manufacture movement just because a refresh occurred. A missing clock disables clock-sensitive labels, not known scores. Stale or implausible live data freezes/disables the live overlay; the confirmed layer remains available with its own timestamp.

A final replaces its temporary live assumption, never adds a second game. A score correction or overturned final creates a revision and deterministic rebuild; do not silently mutate archived observations. A new official poll creates an updated anchor event and an explicitly attributed model baseline change. It does not rewrite prior snapshots or historical official ranks.

## 6. Proposed data architecture and movement history

`official_editions → normalized team/game ledger → derived metrics → confirmed model → provisional scenarios → qualification/seeding → immutable snapshots → shared read API → every page`

- **OfficialEdition:** source, season, publication date, fetched time, source hash, rank/previous-rank/publication record. Immutable; source corrections are separately versioned observations.
- **TeamSeason:** stable ID, verified membership/eligibility, overall/conference records, reconciliation state, source timestamps and ledger checkpoint IDs.
- **GameRevision:** stable game ID, teams, scheduled date, phase, period/clock/scores, completion/winner, observed time, source time if supplied, revision hash.
- **ModelSnapshot:** schema/model/rules versions, input hashes, source observation times, poll edition IDs, confirmed game revision IDs, component scores, full order, qualification reasons, seeds, data coverage, and explanation contributions.
- **ProvisionalSnapshot:** parent confirmed snapshot ID plus exact live assumptions; cannot replace confirmed history.

Record handling must not simply add one win/loss to whatever record ESPN returns: providers may already include the result. Seed from a complete, reconciled season ledger plus provider totals. Increment only newly confirmed IDs not in the checkpoint; rebuild after corrections. When history is incomplete or provider totals conflict, label “record update pending / reconciliation required,” retain the last confirmed dated record, and withhold unsupported model changes. Never fall back to an undated poll record labeled current.

Bootstrap the complete season via ESPN calendar-driven weekly scoreboards; validate event coverage and pagination. Use full team schedules only for holes and reconciliation. Current scoreboard updates are then incremental. Membership must be recursively parsed; results against FCS remain in official records. Deduplicate the same event appearing on two team schedules or multiple week feeds.

Three distinct movement concepts:

1. Official arrows: prior published edition → current published edition of the **same** poll.
2. Fourth Down confirmed movement: prior meaningful confirmed snapshot → current confirmed snapshot of the **same model/rules version**, with a clear “since” timestamp.
3. Live movement: current confirmed baseline → its current provisional child, plus pregame baseline → after-final comparison.

Pin kickoff/pre-game and post-final anchors; also retain poll-release anchors and material field/bubble transitions. A simultaneous batch of finals may jointly explain a movement. Do not claim one game caused an isolated movement without a counterfactual calculation. Explain component changes and run an “all new results except this one” comparison for attributed game effects. Sum-to-total differences should be shown as interaction/combined effects, not forced into a false single-game cause.

No historical model movement exists today. Reconstructed backtests must be labeled reconstructed; never pass them off as snapshots that the live product actually saved.

## 7. Freshness, caching and notification isolation

No production configuration changes are part of this proposal.

Retain v0.8.4 fresh notification fetching and existing four-minute QStash schedule. Model code must not add network work before push processing. Use a separately budgeted, bounded post-delivery task with its own error boundary; an outlook outage must not change push health, claims, cooldowns or eligibility. Existing notification baseline keys stay compatible. Test that optional processing cannot delay provider sends or suppress an existing final/ranking alert.

At the existing cadence, “immediately” means the first successful observation; it cannot mean instant or guaranteed sub-minute delivery. Production finals already show source-state delay as well as polling delay.

For closer-to-live on-screen updates, propose a **separately approved** viewer-driven outlook refresh: one shared source refresh at most once per minute while viewed, global lock, shared read-response cache, no stale response presented as newly computed, and explicit source age. It must not create another QStash schedule or change normal visitor caching. Public readers must not each recompute/persist their own model. This additional refresh is not authorized for activation merely by approving model weights; validate its costs and isolation first. Otherwise launch with the honest four-minute observation limit.

Display separate timestamps: poll published, last confirmed result observed, model calculated, live data observed and model version. On partial outages, preserve a dated last-good confirmed snapshot; mark stale components and stop unsupported provisional/field updates. Test failed/old/inconsistent feeds, missing ESPN Date headers and missed checks.

## 8. Costs and operational constraints

Existing services/project only; no paid data purchase or plan upgrade. Known earlier dashboard observations: Vercel Hobby; QStash native console Free 1,000/day versus installed Marketplace description 500/day; Redis Free 500K commands/month and 250 MB, approximately 25K commands and 10 MB used at the prior check. These are dated observations, not a refreshed billing guarantee.

- Existing four-minute schedule: **360 deliveries/day; 10,800 per 30 days**. Reusing that schedule adds zero scheduler deliveries.
- Bootstrap: roughly one scoreboard request per regular-season calendar week plus standings, with bounded team-schedule reconciliation requests. Exact request count depends on ESPN calendar/coverage. No per-team-per-visitor ingestion.
- Existing local dispatcher simulation: 36 Redis commands for a quiet check; 116 for five score changes; 296 for twenty. These are **simulations**, not actual billing. A 36-command quiet month already implies 388,800 commands before event traffic.
- An added five commands every run would add 54,000/month: 442,800 combined quiet-case commands before busy events/readers. Therefore free-tier safety is **not established**. A naïve new minute-by-minute Redis path could exceed the allowance.
- Prefer replacing redundant placeholder-model writes with content-hash-based writes, not adding a second persistence loop. Batch/atomic writes where measured safe; cache public snapshot reads. Profile the exact candidate implementation against recorded busy-game fixtures and observed billing before enabling it.
- Proposed storage ceiling: combined new model history/input storage ≤64 MiB, snapshot size ≤32 KiB, up to 256 recent snapshots plus 512 pinned event/poll anchors with explicit expiry; preserve content-addressed normalized inputs within the same ceiling. Evict oldest eligible snapshots with a visible history boundary. Never promise indefinite replay after its inputs are evicted. Keep per-model epochs and cap schema payloads.
- Activation gate: measured projected command use including existing push traffic stays below 80% of the free allowance, storage below its safety budget, function duration and invocation limits have headroom, and push regression timing passes. If it does not fit, optimize/reduce model archival/read costs or return for a separate spending decision. Never upgrade automatically.

## 9. Validation and staged delivery after approval

1. **Data foundation:** canonical current records and full event ledger; all-25 audit becomes a repeatable regression. Check every display surface. Preserve official publication snapshots and arrows.
2. **Shadow engine:** implement proposed math/rules without changing the visible field or sending new model alerts. Replay seasons only with correct as-of inputs; no future-result or future-ranking leakage. Compare field/order stability and weight sensitivity. Label retrospective reconstructions.
3. **Snapshot/explanation layer:** exact input replay reproduces output; no duplicate finals; deterministic batch/correction behavior; confirmed/provisional movement separation.
4. **Rules/field gate:** test Power Four champion below 12/outside 25, six-conference qualifier not a champion, Notre Dame protected allocation, ties, incomplete conferences, ineligible teams and unresolved championship tiebreakers. No fabricated champion.
5. **UI rollout:** common data across Home, Rankings context, team details, Watchlist and Playoff; mobile safe areas, desktop, accessibility, stale/error states. Real event evidence is reported separately from fixtures.
6. **Production validation:** verify Tennessee’s current record, all 25 teams and a real future final/live change. Keep kickoff issue #5, real-device evidence and latency work governed by their existing verification criteria. No new model push categories in this scope without separate review.

Required fixtures: ranked win/loss after poll; multiple finals between editions; new edition; byes; duplicate games; live lead reversal/tie; simultaneous upsets affecting other competitors; corrections; missing/late data; a stale future-game record; new season; incomplete opponent history; provider record already includes final; poll-only snapshot unchanged while current record changes. Test that existing scoring, kickoff, halftime, final and ranking sends/subscriptions remain intact.

## 10. Review decisions

Approve or revise these before implementation:

- Résumé-first 35/35/10/20 proposal and its disclosed FCS treatment; no probabilities.
- Current-résumé selection order with separately conditional championship/field scenarios, rather than an unvalidated statistical end-of-season forecast.
- “If leads hold” live overlay, never mixed into confirmed records.
- Three separate movement baselines and bounded replay/history.
- Rules/data completeness and free-tier gates; no arbitrary tiebreak fallback or spending increase.

Approval authorizes implementation and shadow validation of the reviewed design, not a claim its weights predict committee decisions. Production rollout follows the agreed tests, evidence and cost gates. A faster viewer-driven refresh requires separate operational validation before activation.

## 11. Complete AP record audit

Publication: October 18, 2026. Current team records observed October 25 from ESPN’s team endpoints. These are source records, not revised poll ranks.

| AP rank | Team | Poll record | Current ESPN record | Different |
|---:|---|---|---|---|
| 1 | Miami Hurricanes | 6-0 | 7-0 | Yes |
| 2 | BYU Cougars | 6-0 | 6-1 | Yes |
| 3 | Ohio State Buckeyes | 6-1 | 6-1 | No |
| 4 | Notre Dame Fighting Irish | 6-1 | 6-1 | No |
| 5 | Georgia Bulldogs | 6-1 | 6-1 | No |
| 6 | Indiana Hoosiers | 6-1 | 7-1 | Yes |
| 7 | Ole Miss Rebels | 5-1 | 5-2 | Yes |
| 8 | Texas Tech Red Raiders | 6-0 | 6-1 | Yes |
| 9 | UCLA Bruins | 6-0 | 7-0 | Yes |
| 10 | Utah Utes | 6-0 | 7-0 | Yes |
| 11 | Tennessee Volunteers | 6-1 | 6-2 | Yes |
| 12 | Kentucky Wildcats | 6-1 | 7-1 | Yes |
| 13 | Alabama Crimson Tide | 5-2 | 6-2 | Yes |
| 14 | Houston Cougars | 6-1 | 6-2 | Yes |
| 15 | Iowa Hawkeyes | 5-1 | 5-2 | Yes |
| 16 | USC Trojans | 6-1 | 6-2 | Yes |
| 17 | Wake Forest Demon Deacons | 6-1 | 6-1 | No |
| 18 | LSU Tigers | 5-2 | 6-2 | Yes |
| 19 | Texas Longhorns | 4-2 | 5-2 | Yes |
| 20 | Florida Gators | 5-2 | 5-2 | No |
| 21 | Boise State Broncos | 5-1 | 6-1 | Yes |
| 22 | Missouri Tigers | 5-2 | 5-2 | No |
| 23 | SMU Mustangs | 5-1 | 6-1 | Yes |
| 24 | Northwestern Wildcats | 5-1 | 6-1 | Yes |
| 25 | Arizona Wildcats | 5-1 | 6-1 | Yes |

Read-only observations and code review only. No application code, settings, schedules, subscriptions or production deployment changed during this audit. No new engine tests or real engine behavior are claimed.
