# Protected Preview benchmark: measured results and release decision

October 27, 2026. **NO-GO for public Resume / Movers & Losers activation.** The bounded storage/cache workload completed successfully, but automatic live updating and the public serving path are not proven. No bracket, probability or public projection was activated.

## Deployment and isolation

Exactly one deployment was created: `dpl_Ay2EkbWSicgpGU5iJ9ixuWkSLQ7R`, tested source `208247ba099214ec2b618186184f21a1bbaf39a9`. It used the existing Fourth Down project in Preview/staging, region `iad1`. The API rejected the first creation request's `preview` target spelling; it created no deployment. The corrected `staging` request created the single approved deployment.

Unauthenticated requests redirected to Vercel login. Authenticated requests used the existing Vercel CLI session. No public share link or disabled protection was required.

A new temporary ACL user had access only to `fd:{resume-benchmark-*}:*` and the necessary read/write/script commands. Direct GET and EVAL-based GET outside that namespace were denied; an in-scope TTL was allowed. Production credentials were never copied, edited or exposed. Only four branch-scoped Preview variables were provisioned: the dedicated endpoint/token and two benchmark gates. No scheduler, QStash or push credentials were available to this Preview.

## Actual hosted observations

| Measurement | Observed result |
|---|---:|
| Snapshot receipt updates | 12, using captured verified 2026 inputs with distinct benchmark metadata |
| Retained receipts after eviction | 8 |
| Cached-display GET attempts / successes | 400 / 400, concurrency 5 |
| Redis REST command attempts in the benchmark | 535 |
| Internal Lua commands | 159: 51 reads + 108 mutating commands |
| Total benchmark command attempts including nested Lua | 694; includes one denied MEMORY request |
| Benchmark data mutations | 116: 108 Lua + setup SET + display SET + 6 cleanup EXPIRE |
| Additional final-expiry mutations | 7 |
| Total observed data mutations including final key removal | **123 / 400** |
| Mutation reservation at end of hosted workload | 173 / 400; failed responses would not refund reservations |
| Real transport retries / ambiguous script responses | 0 / 0 |
| Controlled lost-response reissues | 3, all recovered by exact receipt without another committed update |
| Cache GET median / p95 | 6.888 / 26.068 ms |
| Full workload process CPU / wall time | 1,961.445 / 2,057.932 ms |
| Separate ten-pass model CPU median / maximum | 323.325 / 450.720 ms |
| Retained logical storage accounting | 218,760 bytes, including the candidate's per-entry allowance |
| Display value | 68,020 bytes of base64-compressed data |
| REST request / response bodies | 565,389 / 27,243,920 bytes, excluding HTTP headers |
| New schedules / notification calls | 0 / 0 |

The 694 command attempts are transport/script instrumentation, not a provider invoice count. The report distinguishes top-level EVAL calls from their internal commands. Additional verification outside the workload used 3 isolation requests, 10 history inspections, 7 final expiry commands, 7 TTL checks and 1 revoked-token check; none fetched the cached display again. Credential provisioning/revocation are separately recorded control-plane operations, not silently counted as snapshot updates.

MEMORY USAGE was not included in the restricted ACL and was denied, so allocator memory is **unmeasured**. The 218,760-byte figure is measured logical retention accounting, not physical Redis RAM. The dashboard is rounded and shared with production polling; it cannot establish exact per-test storage or billed command deltas.

The CPU figures come from the hosted process. A billing-grade Vercel CPU query returned `payment_required` for Observability Plus. No plan or paid add-on was purchased, and process CPU is not presented as an invoice measurement.

## Update, history and display reliability

The twelve controlled receipts exercised compare-and-set writes, a bounded eight-entry retention window, eviction, three controlled acknowledgement-loss recoveries and stable-head reads. The final head matched the newest retained receipt. All eight stored bundles were read back and replayed: 2026, 138 teams, 888 fixtures, preserved canonical model/input identities. All 400 cached reads returned exactly the generated display value.

These are real hosted Redis operations over a **controlled captured-input workload**. Receipt metadata varies to prevent identical-value deduplication; it is not twelve real games, source events or new model outcomes. The same captured model identity across the retained entries is expected. The cached display uses that same captured model, not an automatically advancing public feed.

Therefore this does **not** verify automatic ESPN update → recalculation → changed history → refreshed public display. Nor does it verify a Next.js/CDN hit ratio, traffic across regions, a provider outage, 384-item hosted retention or physical-device delivery. Those outcomes are not marked passed.

## Free-tier headroom and sustainable limits

Final native provider dashboard: approximately **58K / 500K** monthly commands, **29 / 250 MB** storage, **875 MB / 10 GB** bandwidth, displayed cost **$0.00**. Approximate remaining headroom: 442K commands, 221 MB and 9.125 GB. Counters are rounded, asynchronous and include normal production work; before/after differences are not attributed entirely to this benchmark. Five days of usage still do not constitute the complete representative week required by the admission planner.

The 400 cache reads transferred about 27.2 MB of response bodies. At the measured 68,020-byte display size, 10,000 Redis misses/day would transfer about **20.4 GB/month**, exceeding the existing 10 GB allowance before other traffic. This is a scenario, not a visitor forecast. No cache hit rate has been assumed.

Recommended guardrails remain: reserve the notification baseline and 20% service headroom; no per-visitor model computation; store only meaningful confirmed changes; bound history and retries; cache a generic view; withhold unsupported/stale movement; and keep model work outside the notification critical path. These are not yet a validated production updater/serving implementation. No new schedule is proposed or enabled.

## Cleanup and production preservation

The Preview deployment was deleted before clearing its once marker, preventing another invocation. All seven namespaced keys were shortened to a one-second TTL, then independently confirmed absent (`TTL = -2`). All four temporary Preview variables were removed. The temporary ACL user was disabled and its credential was confirmed rejected; the private local secret and protected-response header files were removed. The inactive ACL configuration entry remains OFF, with no usable credential. No default-user setting was changed.

Production remains on `510e7851563dd26600c6060496f50b5a2ec1dc42`, deployment `dpl_AGHSxDBSHuqm2ne959Zxon3H5CCS`. The protected notification verification endpoint remained healthy after cleanup, with a scheduled run at 14:20:03Z and no failed deliveries. No push test was generated. Four-minute scheduling, fresh-fetch behavior, subscriptions and preferences were not modified. Draft PR #19 remains open and unmerged; AP issue #21 remains separate.

## Go/no-go

**GO:** retain the approved private UX; use the measured small-workload evidence to design bounded persistence and caching. Safety revision validation: 316 regression tests, lint, type checking and build passed before the hosted run.

**NO-GO:** public Resume / Movers & Losers today.

Remaining release blockers:

1. Build and privately prove the unattended current-season source-update → recalculation → history → cached-display path, including meaningful changed and missing-data inputs, stale/error recovery and unchanged-input suppression.
2. Establish a representative baseline and enforce a sustainable traffic/cache-miss/update/bandwidth admission policy. The small test is not proof of season-long demand or billing.
3. Measure or conservatively bound physical storage and full website/CDN visitor costs; document provider-billing visibility limits without purchasing services. A further deployment requires new authorization because the single approved deployment has been consumed and removed.

The recommended next step is private updater/cache integration and failure testing, not public activation or a service upgrade.
