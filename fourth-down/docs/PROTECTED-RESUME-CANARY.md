# Protected Resume cache canary — original run consumed

The separately approved Preview from `9e46767` stopped on a strict cache-fill identity assertion and was removed with404 verification. It is not a canary pass. See [results and correction](PROTECTED-CANARY-RESULTS.md). No further deployment is authorized. The successful Redis checkpoint test is not repeated.

## Deployment scope to approve

One Preview in the existing Fourth Down Vercel project, protected by its existing Vercel Authentication. Current read-only project evidence shows SSO protection enabled (`all_except_custom_domains`). Verify protection on the exact new deployment and require an unauthenticated denial before running authenticated load. Use existing origin-scoped Vercel authentication; never disable protection, add bypass rules, purchase services or create Redis credentials.

Set only deployment-scoped canary run/start/end values. The absolute validity window is at most 30 minutes, including build time; the controller's work window is ten minutes. No automatic deployment retry or second canary. Do not alias or promote it to production. Blank the Preview's Redis, push and scheduler credential variables at deployment scope; do not edit project/production settings. If blank overrides or protection cannot be verified, stop.

The canary-only middleware denies all unrelated application routes, all non-GET methods, the image optimizer and all notification/source endpoints. It allows only the replay page/API and local static assets. This middleware and the canary routes are NOT part of the proposed public release. A normal build has the canary disabled, and production cannot enable it through a URL or client flag.

## Hard controlled-load budget

| Resource | Whole-run ceiling |
|---|---:|
| API requests, including failures and validation probes | 20 |
| Page requests, including unauthenticated protection probe | 8 |
| Static asset requests | 32 |
| Cache invalidation/cleanup requests | 4 reserved separately |
| Total controlled application HTTP requests | 64 |
| Reserved response bodies | 32 MiB |
| Per-response reservation | API 768 KiB; page 512 KiB; asset 256 KiB; cleanup 16 KiB |
| Maximum sum of category reservations | 27.0625 MiB |
| Concurrent outgoing requests | 4 |
| Automatic HTTP retries / redirects followed | 0 / 0 |
| Controller work deadline | 10 minutes; cleanup remains available |
| Canary API/page declared maximum duration | 15 seconds each |
| Redis commands, reads, writes, new keys and credentials | **0** |
| ESPN/source requests, push deliveries, schedules | **0** |
| Shared-cache entries | 2 bounded replay packets, each <=768 KiB, plus one small failure receipt |
| Cache revalidation | 60 seconds, using the actual prepared adapter |

The one local supervisor reserves each request in an append+fsync journal before dispatch. Workers/browser requests receive no raw authenticated transport. Concurrent work queues behind four permits; no request can skip its reservation. Failures retain reservations, duplicate tickets and corrupt/partial ledgers fail closed, and restarts use the SAME run/journal. The browser's requests are fulfilled through this supervisor; foreign origins, POSTs, service workers and automatic UI refresh are blocked/disabled. Do not manually browse the hosted canary outside the supervised test.

These are enforceable limits on the controlled test load, not a claim that client code can impose a global cap on Vercel's authentication/control plane or a human owner bypassing the controller. The 15-second route declaration bounds requested handler duration, not exact billed CPU. Vercel-managed cache internals and control-plane requests are separately measured/reported where available. Existing production traffic is not attributed to the canary.

## Sealed workload

1. Confirm exact deployment/project/Preview identity, fresh plan headroom and protection without changing settings. A protected login/denial cannot count as a successful app response.
2. Reuse the captured 2026 ledger and existing model. The first scheduled matchup involving a captured current Top 25 team receives a fixed synthetic 28–14 final, explicitly labeled controlled replay. No team-specific tuning, invented live event or probability claim.
3. Run the existing current-season producer/service through baseline, confirmed-result update, duplicate update, two retained checkpoints and stale-source withholding. The per-cache-fill temporary file store is deleted in finally. This tests the replay path; it is not a new distributed-persistence or real-event verification claim.
4. Exercise the ACTUAL Next shared-cache adapter: cold/warm reads, a four-request warm burst, separately keyed before/after packets, negative caching, 60-second expiry/refresh, and final tag invalidation. Compare snapshot/input identities and resume facts across reads. Fill IDs measure observed reuse and amplification, not an assumed immediate global cache identity. Source-read logs distinguish fills from visitor calls.
5. Show the existing Team Resumes/Movers UI on desktop and iPhone-sized Chromium; check explained movement, labels, mobile overflow and automated accessibility. Follow actions and automatic polling are disabled only in canary mode. Existing production browser evidence is reused rather than repeating unrelated tests.
6. Capture bounded receipts, request IDs, actual response bytes, cache-fill IDs, local/handler timings and available Vercel execution/CPU/cache metrics. The response's process CPU is NOT Vercel billing. If CPU or cache billing units are unavailable, report that explicitly; do not call them verified or extrapolate unlimited capacity.
7. Invalidate only the three run-specific tags, remove only this Preview deployment after evidence is saved, and verify the expired/private gates. No production data, preferences, subscription, poll, credential or four-minute schedule changes.

## Decision and shortest release path

A pass means the protected cache/UI replay boundary works. The disabled feed capture sink is separately covered by targeted no-extra-request/fresh-fetch tests. This canary does NOT establish real live-game behavior, distributed stale-writer interleavings, production ingestion wiring, or full-season visitor capacity. Do not deploy/publicly activate automatically after a pass.

Immediately prepare the small public candidate: 2026 Team Resumes, explained Movers & Losers, supporting wins/losses/remaining games, timestamps and separate official poll context. Connect confirmed-result ingestion through the existing four-minute verified feed, without adding a schedule. Exclude definitive brackets, qualification guarantees, probabilities and model expansion.

If current/live freshness or the sustainable write budget remains blocked, the largest independently releasable slice is latest CONFIRMED 2026 resumes and explained movement, clearly timestamped and not presented as a live projection. Preserve the existing live freshness gate; use explicit saved-confirmed evidence rather than falsely renewing old inputs. Ask for final production approval only once that chosen scope's essential checks pass.

**Any corrected repeat requires NEW separate approval:** create, test and remove ONE protected Preview under these limits, using existing Vercel authentication and deployment-only nonsecret/blank safety overrides. No new credentials, Redis run, production deployment, merge or public activation is included.

## Local evidence

The production-build rehearsal passed with 34 requests (12 API, three pages, 18 assets, one cleanup), 15,745,024 reserved bytes and 6,296,821 actual response-body bytes. Cache hit and expiry refresh were observed; both desktop and iPhone-sized browser views passed automated accessibility and overflow checks. The hosted plan adds a four-request warm burst within the existing 20-API/64-total ceilings. Six targeted replay, gate, middleware, durable-budget, HTTP-supervisor and hosted-admission tests passed, plus type checking and lint. No hosted canary, Vercel CPU claim or live event is included in this local evidence.

Recovery review tightened hosted admission to reject missing/invalid expiry timestamps, excessive validity windows and production targets. A failed workload writes a partial report and attempts run-specific tag cleanup from the reserved allowance, without retrying an already attempted cleanup. Preview removal remains required even if admission or cleanup fails.
