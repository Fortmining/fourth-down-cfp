# Résumé-first release preview — Phase 6, October 26, 2026

## State and release boundary

PR #23 was approved, merged and released independently. Production commit: `510e7851563dd26600c6060496f50b5a2ec1dc42`; Vercel deployment: `dpl_AGHSxDBSHuqm2ne959Zxon3H5CCS`, READY, existing `fourth-down-cfp` project. Its release contained verified mascot names, display fallbacks, the reproduced missing-record mobile overflow correction, tests/docs and the feature-branch deployment exclusion. No private model was deployed.

PR #19 remains a draft. This phase reconciles released main into the development branch, then adds a display adapter, private standalone UI, replay regressions and a locally exercised retention candidate. No production route imports the new display adapter or installs a model writer. No new schedule, service, environment variable, credential change or notification-setting change is made. AP tied-rank notification issue #21 remains separate.

## Concrete preview

Generate and serve a local-only review artifact:

```sh
SHADOW_SEED=/absolute/path/to/captured-inputs.json \
SHADOW_PREVIEW=/absolute/path/outside/repo/preview \
node --experimental-strip-types scripts/resume-preview.mjs

SHADOW_PREVIEW=/absolute/path/outside/repo/preview \
node scripts/serve-resume-preview.mjs
```

Default address: `http://127.0.0.1:3013`. The server binds loopback only and serves just the generated HTML and review JSON; it does not register a service worker, request notification permissions, read browser preferences or expose a new production feature.

The current review uses the genuine October 26 22:07:01Z capture: 138 teams, 888 season fixtures, complete ledger reconciliation, three manual ESPN source requests. This is a timestamped research capture, not an automatically updating public service. The UI explicitly labels an aged capture as archived and withholds live assumptions. Current 2026 view starts without claimed movement because no earlier comparable v1.2 production snapshot was established.

The second view uses genuine October 5 and October 19, 2025 Git-archived inputs, including confirmed outcomes between them. The algorithm was developed later; these are retrospective replays, not forecasts published in 2025. The committed compressed fixture contains the full FBS universes and source receipts, SHA256 `814f169cee531a5c9341bd34c1661a695fa059c6d3b540be6d70573e701c8b59`. Original CSV blob identities and conservative historical poll lag are preserved. No future game results were added to an earlier input vintage.

Proposed public facts and labels:

- Complete confirmed overall/conference records, or an explicit partial/conflicting-ledger fallback.
- Leading wins by the independent opponent-record index, all confirmed losses, exact final scores and existing game/team links. An untracked opponent has no invented name or strength value.
- An independent smoothed opponent-record index, not official strength of schedule. Formula: `(opponent wins + 1)/(opponent games + 2)`, excluding head-to-head results; untracked opponents are excluded from the index. Missing values remain unavailable. The testing model's explicit untracked-opponent result fallback is disclosed separately.
- Conference win-percentage position with ties left tied, including supplied conference members; it is not a championship seed or qualification decision.
- Published AP/Coaches/CFP positions, dates and provider-supplied prior-edition arrows, separate from independently calculated résumé movement.
- Rule-only championship/playoff access conditions. No named automatic qualifiers, predicted championship participants, definitive field/bracket or numerical playoff probabilities.

The 35/35/10/20 formula remains a **testing candidate**, not an approved public scoring formula. The UI has searchable/paged cards, expandable evidence, responsive layouts, explicit private-preview labels and an archived replay selector. Changing the UI selector does not change subscriptions or production data.

## Movement explanations and missing-data protections

`resume-view.ts` consumes compatible, versioned confirmed snapshots. It validates input identities and epochs, checks complete source coverage, identifies absent previously confirmed finals, and withholds movement/order claims for invalid results, record conflicts, missing anchors, incompatible model versions/weights/universes or incomplete prior evidence. Repeated observations do not invent movement. Unknown eligibility never becomes a fabricated ban.

Explanations identify direct confirmed wins/losses, corrections under the same game identity, changes in opponents' records that affect earlier results, published-poll anchor changes and relative movement caused by other teams. If records and score do not change, a new position is not described as a new win. Score changes can be explained even when the displayed position stays unchanged.

Attribution uses the model's additive components: poll contribution is `P_weight × (new P − old P)`; the remainder is results/ledger contribution, with the existing one-millionth score-rounding tolerance. Re-running an old poll at the later clock would expire that poll after eight days and falsely assign its loss of weight to game results. The display adapter therefore does not use that misleading counterfactual. It never rewrites a historical edition or derives an official poll arrow from a game result.

Fresh, valid live-leader assumptions are computed separately and explicitly labeled conditional. Tied scores, stale captures and unsupported live states do not assert a hypothetical winner. A provisional snapshot cannot replace the confirmed baseline. Qualification text is season-specific: 2024 champion byes, 2025 ranking-order seeding, and 2026 access rules remain distinct.

## Validation

Replay tests cover real multi-game archive transitions and indirect opponent effects, poll-only changes, no-op observations, absent finals, incomplete feeds, source conflicts, model-version changes, source-identity tampering and historical rule separation. Additional **simulations**, clearly named, exercise a corrected result, a controlled ASU–Texas Tech result replay and fresh/stale/tied live overlays. Those tests do not establish real live delivery or a committee's intended choices.

Chromium desktop and iPhone-sized WebKit checks cover current/replay records, final-result/poll separation, search, pagination, internal links, 320/390/430/1280px layouts and axe accessibility checks. No physical iPhone test is claimed. Existing intermittent Watchlist WebKit instability remains documented; no forced click or weakened assertion was added.

A clean build also removed duplicate generated `.next/types/* 2.ts` declarations left in the local cache. Source declarations were not deleted or weakened. Final tests/build/type-check outcomes are recorded in the PR and private validation output.

## Measured operations and retention

Local real-input measurement of confirmed/provisional computation, display derivation, compression and retention envelope (10 runs): median CPU 245.312ms, maximum 319.764ms; maximum pair value 26,736 bytes; compressed display view up to 29,357 bytes. Running that measured median every four minutes for 30 days is an illustrative 0.736 local CPU hours, not a hosted bill or Vercel benchmark. An unchanged semantic state has a stable identity even when the request receipt changes; season/model scope is explicit. Returning to an earlier state uses a new receipt so corrections can retain their actual chronology.

The retention candidate was executed against temporary local Redis on a private Unix socket with **1,000 synthetic storage writes using a real captured payload**. It retained 384 receipts in approximately 10.36MB of key memory, evicted payload/index/size metadata together, respected a byte cap, rejected stale CAS, did not write for an unchanged semantic state, and preserved a new receipt when returning to an earlier state. All five keys are explicitly declared in one hash-tagged shadow namespace; no dynamic undeclared payload keys are used. A shared payload hash permits bounded per-receipt eviction. Thirty-five-day expiry is an idle expiry for the bounded store, not a guarantee that every snapshot will remain for 35 days. Missing baselines must yield unavailable movement rather than a comparison to an arbitrary older snapshot.

Local command statistics measure approximately 13 operations without eviction and 16 with batch eviction, including EVAL. The admission planner now reserves **20 operations per meaningful pair**, plus the existing-cadence head reads and explicit visitor/cache-miss read reserve. At 360 checks/day, head reads alone would add 10,800 commands/30 days. A 20,000-command total monthly engine envelope would leave room for at most 460 meaningful pairs under that reserve, before any unreserved visitor reads. That may be too restrictive for busy Saturdays; it is an example cap, not an activation recommendation. Actual provider billing and transport retries remain unmeasured. No production transport invokes this Lua candidate.

Read-only native Vercel dashboard observations (last-30-days window; dashboard warns data can lag up to one hour):

| Scope | Active CPU | Provisioned memory | Invocations |
| --- | --- | --- | --- |
| Fourth Down | 16m 32s | 0.81 GB-hours | 2,999 |
| Shared Hobby owner | 16m 51s / 4h | 0.84 / 360 GB-hours | 3,180 / 1,000,000 |

These are actual existing hosted baseline totals, not incremental engine costs. Current CPU and storage headroom make a limited pilot plausible. A representative complete-week Redis pattern, concurrent visitor/cache-miss demand and hosted retry/billing validation still gate production admission. Keep notification capacity reserved first; fail visibly to a saved baseline or unavailable movement if the model budget is exhausted. Never fail the notification run to update the outlook.

Recommended integration, **not installed**: reuse already-fresh source data after the existing notification critical path; compute meaningful model state once per check, write only changed states, cache generic display views and avoid per-visitor model recomputation. Use bounded receipt/index retention, preserve valid comparison context and label unavailable history. Do not add polling, QStash messages, paid storage or a second project.

## Remaining decision and evidence gates

This milestone is ready for review of a limited résumé-first UI and its explanation contract. Public formula/wording approval and a bounded hosted shadow pilot are separate from approving a definitive bracket. PR #19 remains draft and unmerged.

For the proposed factual fields, unverified Big Ten tie rules and broad institutional eligibility are handled by withholding qualification claims; they do not justify hiding actual records or inventing standings tiebreaks. Full 2026 Big Ten policy confirmation, remaining conference cases, eligibility evidence and stronger selection/seeding validation still block named qualifiers, a definitive projected field and bracket. Existing model comparisons do not establish that this testing formula is a better committee-selection forecast than published polls.

## October 27 continuation: universe-wide explanation audit

The archived October 5 → October 19, 2025 replay was audited across all 136 teams. 131 changed résumé position. Every changed score or position had an explanation; every referenced result was confirmed as of the later capture, and direct-result explanations involved the named team. Poll/result attribution reconciled for every row. This establishes explanation coverage for this replay, not predictive accuracy or proof that every explanation is sufficient for public use.

A private-display fallback was corrected: conference position is now withheld when any peer in that conference has conflicting records, an absent previously confirmed final, or invalid final evidence. A team's independently verified own record remains visible. Conference positions remain simple win-percentage comparisons, never championship tiebreakers.

Validation: 300 regression tests pass; lint and type checking pass. No production integrations, schedules, credentials, preferences, model weights or public qualification claims changed. Hosted-budget admission and public UI/methodology approval remain separate gates.
