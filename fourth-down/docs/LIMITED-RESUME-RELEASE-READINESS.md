# Limited Resume release: NO-GO pending hosted operating evidence

Decision date: October 27, 2026. Scope: Team Resumes and Movers & Losers only. No definitive bracket, named playoff field or numerical playoff probabilities.

## What is ready for review

Working local preview: `http://127.0.0.1:3017/`. The approved styling and five-tab navigation are retained. It now defaults to the saved **2026** update; **Archived 2025 movement replay** is a separate explicit selection. Both show their actual capture dates. The current 2026 example is a saved comparison, not a running public feed.

Every nonzero movement badge visibly says **resume positions**, including its screen-reader label. Official AP/Coaches poll places and arrows remain in separate labeled areas. A position change is neither a poll move nor a projected playoff seed.

Movement explanations now derive four measured contributions from compatible confirmed snapshots:

- Win rate: `W_weight × (new W − old W)`.
- Results against opponents: `R_weight × (new R − old R)`.
- Opponent-record strength: `S_weight × (new S − old S)`, using the existing model's zero fallback for an unavailable component and disclosing availability changes.
- Published-ranking input: `P_weight × (new P − old P)`.

The four contributions reconcile to the change in the experimental score within its existing one-millionth rounding tolerance. They are not derived from the official poll's prior-edition arrow. If a team's own comparison improves while it falls in position, or weakens while it gains positions, the text explicitly attributes the relative shift to changes elsewhere in the order. All measured factors are available in expandable evidence; the compact story highlights actual results and the largest measured factor.

The unchanged testing formula still gives published rankings a 20% weight. In the archived Notre Dame example that component was its largest measured score change. It would be incorrect to attribute all 28 resume positions to the two wins alone, or to call those positions an AP/Coaches move. No weights were tuned to improve a named team's explanation.

The existing safeguards remain: complete versus missing records, immutable poll editions, compatible model versions/weights, separate confirmed and conditional results, no fabricated scores/times, and withheld movement for unsupported comparisons. Historical model IDs are unchanged. Conference win-percentage place with ties kept is not a championship qualification decision.

## Validation

314 regression tests pass, plus lint, type checking and production build. Browser validation covers Chromium, Firefox, desktop WebKit and iPhone-sized WebKit; 320/390/430/1280px layouts; keyboard and safe-area navigation; exact saved poll positions/dates; current-season default; archived movement units; empty/missing-data states; and accessibility checks in six appearance/colorway combinations. This is browser automation, not physical-iPhone testing. The bounded resource-writer tests use a simulated transport and are not hosted measurements.

## Actual operating evidence versus unmeasured work

| Evidence | Result | What it establishes |
|---|---|---|
| Current native Redis Usage dashboard, read-only | 56,080 / 500,000 monthly commands: 32,835 writes + 23,245 reads | Existing service baseline, not engine-write billing |
| Current native Redis storage / bandwidth / cost | 28 / 250 MB; 832 MB / 10 GB; $0.00 displayed | Existing headroom, not a public admission guarantee |
| Daily command chart, UTC | Fri ~4.9K, Sat ~19K, Sun ~14K, Mon ~11K, Tue partial ~5.5K | Includes a game-day weekend but not seven consecutive complete days |
| Earlier protected hosted CPU run, source `c8693d8` | Median 299.626ms across ten passes; 138 teams / 888 fixtures | Real earlier hosted process CPU, not an invoice or latest integrated writer test |
| Latest local pipeline measurement | Median 233.217ms, max 341.575ms; pair 26,736 bytes; compressed fan view 51,040 bytes | Local CPU and serialized sizes only |
| Prior local Redis retention experiment | Approximately 10.36 MB for 384 receipts | Local storage evidence; not current provider allocator/billing evidence |
| Prepared hosted write/retry/cache-read test | **Not executed** | Disabled code and simulated-transport tests are not hosted validation |

No database-write credential is available through the local monitor. Project variable **target metadata only**, requested without decryption, confirms the existing Redis connection is production-only. No credentials were retrieved, changed or printed. Preview currently lacks Redis access. The realistic request-path measurement therefore requires approval for a protected Preview deployment and temporary Redis integration access for that test. Neither has been configured.

Provider storage bytes and in-memory allocation must not be conflated; see [Upstash Insights](https://upstash.com/docs/redis/howto/insights). The retention script declares every key explicitly, as required by [Redis EVAL](https://redis.io/docs/latest/commands/eval/). Conservative command reservations are not substituted for actual provider billing.

## Reviewable, disabled hosted benchmark

`POST /api/private/resume-benchmark` returns 404 unless **both** `VERCEL_ENV=preview` and `FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK=true`. GET remains the existing bounded CPU benchmark. No deployment was made to enable this POST.

Proposed one-shot workload, with the existing project's authentication protection kept on:

- Fresh, manually verified free-tier receipt required, less than ten minutes old. Refuse the run if its reserves would exceed 80% of any command, storage or bandwidth limit.
- 400 controlled writes using unique, replayable variants of the real research payload; 384 retained receipts; 16 MiB logical cap; individual pairs at most 64 KiB and cached display at most 128 KiB.
- Eight controlled response-loss retries; actual transport failures get at most one retry per write. An ambiguous success is resolved by checking the exact receipt and semantic identity, not by creating another receipt.
- 100 unchanged-state head reads and 400 cached-view reads at concurrency five. The cache-read workload is not a complete website/CDN visitor test.
- At most 10,000 conservative command units reserved, including expiry recovery; 32 MB storage reserve and 128 MB wire reserve. All keys use a deployment-specific `fd:{resume-benchmark-…}:` namespace. No app keys, scans, deletes, push calls or QStash messages.
- Test data expires after one hour. A small once-per-deployment marker expires after 35 days to prevent accidental repeat runs. Expiry is attempted even on partial failure; a failure to verify expiry cannot return a successful measurement. Inspect the isolated namespace after an incomplete run if storage was unavailable.
- Main work stops after 25 seconds; fixed expiry checks have bounded transport timeouts within the 60-second function ceiling. Report actual request/response body bytes, process CPU, wall time, cache-read latency, retention count and memory where supported. Body-byte counters exclude headers and are not invoice totals.

This creates no public serving route for Resume data, changes no production configuration and grants no production activation. The Preview flag is non-secret; production notification secrets and push keys must remain production-only.

## Operating envelopes proposed, not enabled

1. Reuse the existing four-minute checks **after** notification delivery's critical path; add no schedule or QStash deliveries. A model failure must never fail or delay alert processing.
2. For the initial limited feature, retain confirmed meaningful updates, not every live clock/score revision. An unchanged model state does not create history.
3. Bound history to 384 receipts / 16 MiB logical data, measure provider overhead, and enforce explicit expiry and compatible before/after context. Missing history means unavailable movement, never a comparison with an arbitrary old baseline.
4. Admit model work only below 80% of measured plan limits after reserving the notification baseline, fixed head reads and public cache misses. A complete representative week is required by the existing planner; the current five-day chart does not satisfy that gate. Budget exhaustion must withhold stale experimental comparisons while leaving current records and notifications functional.
5. Bound retries; use stable identity and verified CAS recovery. No unbounded retry or per-visitor model recomputation.
6. Cache generic views, account for cache misses and regions, and test source-update → stored history → current view, including failure recovery. No cache-hit ratio or visitor rate has been established yet.

Illustrative 30-day traffic scenarios, **not measurements or forecasts**, using 600 changed updates, the conservative 20-unit write allowance, 10,800 head reads, one Redis GET per cache miss, and a 68,056-byte base64 display value:

| Cache misses/day | Monthly additional command reservation | Redis display-value transfer/month, excluding overhead |
|---:|---:|---:|
| 100 | 25,800 | ~0.20 GB |
| 1,000 | 52,800 | ~2.04 GB |
| 10,000 | 322,800 | ~20.42 GB — exceeds the current bandwidth allowance by itself |

The actual number of meaningful updates is unmeasured; fixture kickoff times cannot be used as first-Final observations. A shared-cache hit ratio cannot be assumed. Saturday–Monday's rounded 44K commands extended to a full month would be ~440K before model work, while repeating the Saturday peak would exceed 500K. Those sensitivities explain why low current month-to-date usage is not a sufficient release gate.

## Final assessment and remaining blockers

**GO:** visual direction, 2026 default/archived separation, explicit movement units, measured-driver presentation and source-consistency review.

**NO-GO:** public Resume / Movers & Losers activation today.

Remaining blockers:

1. **Approval-dependent hosted measurement:** deploy the protected benchmark and provide temporary Preview Redis access, then measure real writes/recovery/storage and cache-load behavior. Reconcile provider usage/billing rather than declaring the simulated transport a pass.
2. **Sustainable admission:** complete the usage window, reserve normal notification traffic, and choose/enforce public cache-miss, update, CPU and bandwidth limits from actual results. Current release limits are proposed, not demonstrated.
3. **Production path validation:** the unattended current-season updater, history persistence and public cache/freshness/failure path are not installed or proven end to end. Test this privately before requesting a production rollout. Do not release a saved research capture as a live feature.

Unresolved championship tiebreakers and eligibility still block definitive qualifier/bracket claims; those fields are intentionally excluded from this limited release and are not presented as blockers to verified records themselves.

No merge, deployment, production data write, poll-schedule change, subscription change, credential change or service-plan upgrade occurred during this work. The hourly alert monitor remains separate.
