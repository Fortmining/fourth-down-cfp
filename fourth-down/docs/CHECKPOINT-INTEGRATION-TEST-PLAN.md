# Protected checkpoint integration — preparation and approval plan

**One supervised run was separately approved and consumed. It failed closed; cleanup and revocation are verified. See [hosted results](HOSTED-CHECKPOINT-RESULTS.md). No further hosted run is authorized. No deployment, public activation, production configuration or polling change occurred.** Continue from `80adcee` in draft PR #19. Public Resume and Movers & Losers remain NO-GO.

## Recommended topology: one credentialed supervisor, no Redis credentials in Preview

Use one manually supervised local controller with a durable, append-only budget journal outside the synced project directory. All logical workers and all recovery attempts pass through that controller. The temporary ACL permits only the four keys for one approved run identity. Workers receive neither the credential nor a raw Redis transport. No public endpoint, scheduler, QStash job or background retry can initiate database work.

**Do not deploy a Redis-credentialed Vercel benchmark endpoint for this test.** Ephemeral independent Vercel instances cannot share a local file budget, and a Redis counter cannot cap its own rejected command overhead. This supervised topology can test the actual protocol on hosted Upstash without that loophole or a new service. Separate Vercel CPU, cold-start and public HTTP-cache behavior remain outside this run and unverified; no full production-equivalence claim will be made.

Only the same canonical local journal and run ID may resume. Exclusive locks serialize reservations across processes; each reservation is appended and fsynced before dispatch. Duplicate tickets, changed manifests, missing/corrupt/partial journals and stale locks fail closed. A stale lock is not automatically removed. There is no refund for failed, partial or ambiguously acknowledged operations, and no fresh journal/run ID on retry. This protects against test concurrency and interruption, not a malicious operator who has the credential and bypasses the controller.

## Exact whole-run limits

| Resource | Hard cap, including all phases |
|---|---:|
| Total Redis commands, EVAL plus every nested call | 2,400 |
| Write charges: EVAL plus nested mutations | 900 |
| Read commands, including nested reads and verification | 1,200 |
| Transport attempts | 320; each has an 8-second deadline |
| Request/response body reservation | 160 MiB |
| Work deadline, durable across restarts | 10 minutes; cleanup remains available |
| Automatic transport retries | 0 |
| Explicit ticketed recovery sequences | 3 |
| State / display / head or meter value | 1 MiB / 128 KiB / 4 KiB |
| Normal test data lifetime | 3,600 seconds |
| Cleanup expiry | 1 second, then absence verification |

Reserved phases cannot be spent by workload:

| Phase | Commands | Mutations | Reads | Attempts | Wire reservation |
|---|---:|---:|---:|---:|---:|
| Setup/admission | 16 | 8 | 8 | 16 | 64 KiB |
| Work, faults and recovery | 2,352 | 876 | 1,176 | 280 | Total minus 192 KiB |
| Cleanup and revocation verification | 32 | 16 | 16 | 24 | 128 KiB |

The setup/cleanup envelopes deliberately retain spare capacity. ACL creation/revocation are at most two separate control-plane actions, with no automatic retry; usage receipts are at most two control-plane reads. Any Redis data-plane verification still goes through the controller and counts toward the table. Provider-internal replication/control-plane implementation is not represented as client-issued commands.

The new approval increases the proposed test envelope from the prior benchmark's limits; **those prior limits/approval are not reused**. If smaller limits are required, reduce the cases explicitly rather than equating snapshot updates with mutations.

## Enforcement and instrumentation

`integration-test-budget.ts` accepts only the exact protocol-2 script, exact four keys and bounded argument sizes. It has no credential/environment reader. It charges the worst-case operation before I/O, including attempts with lost responses. Lua instrumentation shadows `redis.call`, checks the key, operation, command/read/mutation counters and value sizes **before each nested call**, and forces the one-hour TTL. No arbitrary scripts, pipelines, scans, deletes, publishing or application keys are permitted. The prepared supervisor uses one direct HTTP request per reservation, an eight-second abort deadline, no SDK retries and no followed redirects; offline fake HTTP tests verify that errors/timeouts remain charged and credentials never appear in errors. Lua syntax/runtime failure is not a successful test; its already-consumed reservation remains charged.

| Protocol operation | Command reserve | Mutation reserve | Read reserve |
|---|---:|---:|---:|
| Read state plus freshness head | 5 | 2 | 3 |
| Commit state, display and head | 9 | 5 | 3 |
| Verify and renew unchanged freshness | 7 | 3 | 4 |
| Read materialized display | 7 | 2 | 4 |

For this test, write charges deliberately count EVAL itself as one potential mutating command **in addition to** every nested SET. This is stricter than the application planner’s key-mutation count; it prevents ambiguity about what “writes” includes. Direct EXPIRE counts as one write. Successful script replies include execution counts with this conservative EVAL charge. Unacknowledged attempts keep their full reserved cost and are reported as ambiguous, never zero. The controller reports reservations, confirmed counts and ambiguity separately. Failed cleanup never becomes a successful cleanup receipt. Expiry must be verified with TTL = -2; revocation requires explicit authorization-denial evidence, not a network error.

Maximum logical key-value bodies are about 1.14 MiB. Actual Redis physical memory and provider overhead must be reported separately if available through authorized control-plane evidence; they are not inferred from gzip size.

## Sealed workload

1. Genuine captured 2025 baseline and subsequent confirmed results; verify records, official poll dates and explained resume changes.
2. Thirty-two additional **invented score corrections** over captured inputs to exercise 34 versions, a 32-entry retention window and eviction. These are cost/failure scenarios, not real historical events or forecast-accuracy evidence.
3. One controlled lost acknowledgement after a snapshot commit, followed by a ticketed recovery; no duplicate history.
4. Twenty-four unchanged four-minute source-verification steps. Each check reserves all seven commands, three write charges (EVAL plus two nested mutations) and four reads; none is assumed free.
5. Separate workers read the cached display; test delayed writer versus newer checkpoint, incomplete/stale observations, and delayed transport timestamps.
6. Historical lookup must use its retained predecessor; an evicted receipt must be unavailable.
7. Force short expiry, verify all four keys absent, revoke the temporary ACL, verify denial once, and remove the local temporary credential. Retain only the secret-free manifest, journal, report and hashes.

**Validation:** 381 regression tests pass, including 15 final budget/HTTP safeguards, plus type checking and lint. The preparation production build passed. Independent-worker journal contention, budget exhaustion, wire/cleanup reserves, corrupt/partial logs, deadline persistence, stale writers, history bookkeeping, lost acknowledgement, HTTP timeout, no automatic retries and credential-error redaction have offline coverage. Actual Lua execution remains unverified.

Final offline rehearsal reserved **1,839 commands, 810 conservative write charges, 902 reads and 273 attempts**, including one recovery and expiry/absence verification. Body reservation was **127,493,515 bytes (~121.6 MiB)**; simulated logical stored bodies were **832,404 bytes**. Actual local process CPU was **28.672 seconds**, elapsed **41.208 seconds**. These are local simulation/CPU results, not provider measurements. The journal and report are hash-sealed; no hosted request or real credential was used.

Offline results are in the PR report and private `outputs/v086/phase13/` artifacts. The local simulator does not execute Lua or establish provider support. The protected hosted run will test precisely that missing boundary. The initial offline attempt hit the existing display byte throttle; the retention workload now uses explicit two-minute virtual observation spacing. Production limits were not weakened. An initial history lookup also exposed a real freshness-head/bookkeeping interaction; state reads now carry the authoritative head and bookkeeping preserves its already-verified freshness. Truly delayed writers still fail the monotonic guard.

## Isolation and run admission

Before any provisioning, approve a single fixed run identity and canonical journal root. Temporary ACL key patterns must name only that run's `state`, `meter`, `display`, and `head` keys, with only EVAL, GET, SET, EXISTS, EXPIRE and TTL. No production application, notification, subscription or scheduler key is accessible. If the provider cannot enforce that isolation, stop. Do not reuse production or previous benchmark credentials.

The credential stays only in a private mode-0600 local file owned by the supervisor. It is never committed, logged, returned in an exception, passed to workers or put in Vercel. No production environment variable is edited. Provisioning and later revocation require the new explicit approval below.

A fresh resource receipt must show the whole reservation fits existing service allowances with 20% account headroom: current commands + 2,400; bandwidth + 160 MiB; physical storage reserve of 8 MiB. The last saved account reading is not fresh admission evidence. If usage, ACL capability or reliable cleanup cannot be established, do not start. No paid monitoring or service upgrade.

After interruption, never create replacement data/credentials or reset counters automatically. Preserve the same journal and inspect the isolated run. If safe continuation cannot be established, revoke access and let the one-hour TTL expire; report cleanup as incomplete until confirmed.

## Realistic operating assumptions and Redis reductions

This test is not a claim that 50 Redis misses/day supports a public football app. The current injected shared-display implementation makes a Redis call for every display invocation. Cross-worker HTTP caching/coalescing is **not implemented or validated**. For example, 1,000 visitors making three views each could mean 3,000 database reads/day in that path, far above the candidate allowance.

At 70 meaningful updates/week and existing 360 verification checks/day, protocol 2 scenarios reserve:

| Shared misses/day | Commands per 30 days | Peak day commands (60 updates) |
|---|---:|---:|
| 50 | 95,100 | 4,670 |
| 100 | 105,600 | 5,020 |
| 240 | 135,000 | 6,000 |
| 480 | 185,400 | 7,680 |

An eight-hour busy period with a globally shared 60-second cache can still require roughly 480 refreshes, plus invalidations/cold starts, even with thousands of cache hits. Multiple independent regions can multiply misses. Neither 50 misses nor an arbitrary 99% hit rate is an admission assumption without evidence.

Evaluate after measuring protocol 2:

- Publish/coalesce materialized displays through a versioned shared HTTP cache, invalidated on confirmed results. Preserve the six-minute source-age gate and explicitly stale fallback. Measure cold-start/region amplification before claiming savings.
- Combine compatible head/meter operations in a separately versioned protocol. A five-command freshness design would reduce recurring verification from 75,600 to 54,000 commands/month, but must preserve digest, quota and partial-write safety. It is a proposal, not implemented or included in this run.
- Retain compact freshness and semantic deduplication; avoid full retained-state transfers for unchanged inputs. Use already-fetched verified sources, never a new notification poll.
- If verified total-account headroom supports a different internal workload allowance, evaluate it separately. Do not silently raise caps, buy a plan, lengthen freshness, drop checks or claim higher visitor capacity.

## Exact approval requested next

Approve **one manually supervised hosted-Upstash protocol integration run** under the limits above, including creation and revocation of one least-privilege temporary ACL limited to the four approved test keys. No new Preview deployment is requested for this first run, and no Redis credential may be placed in Preview. No merge, public activation, production change, schedule change, subscription/preference change or service upgrade is included.

The run is GO only after fresh admission and isolation checks pass. Public feature release remains **NO-GO** regardless of a successful isolated test until the real current-season producer, hosted CPU/cache path and account-wide operating envelope are verified.
