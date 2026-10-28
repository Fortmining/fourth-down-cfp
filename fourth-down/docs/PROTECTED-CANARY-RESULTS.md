> Superseded for release readiness by [the corrected successful canary](CORRECTED-CANARY-RESULTS.md). This first-run failure evidence is retained unchanged below.

# Protected cache canary — stopped, removed, not a pass

The single approved Preview was created from `9e46767` in the existing Fourth Down project, using Vercel Authentication and deployment-only canary/blank credential overrides. No production alias, project setting, schedule, user preference, subscription or service plan was changed. No second deployment was created.

Deployment: `dpl_CQj6uSb6YFey8QKXHcnXxV3VRHAE`, Preview, Node24/iad1. Its creation receipt and project metadata confirmed Vercel Authentication; the controller's unauthenticated probe was denied before authenticated app traffic. The CLI was already authenticated; no new ACL or bypass secret was provisioned.

## Observed result

The first sequential cold/warm pair reused a fill. The subsequent four-request warm burst included a different fill ID and stopped the workload under the original strict assertion. Scoped Vercel logs show **two backend source fills for six authenticated reads**. This disproves an immediate global-single-fill assumption; it does not by itself prove a corrupted resume or identify the platform's cache propagation mechanism. The old failure report did not retain packet identities, so semantic consistency across that burst cannot be claimed verified.

The canary therefore did NOT reach the controlled final, duplicate/checkpoint/history step, hosted mobile/desktop views, negative-cache case or expiry refresh. Previous local and hosted Redis evidence remains valid but is not substituted for these unobserved outcomes.

## Resource and cleanup evidence

- Eight metered application requests: six API, one protection probe and one reserved cleanup call. Concurrency never exceeded four; no automatic retries or redirects followed.
- **5,259,264 reserved response bytes**, within the 32 MiB/64-request limits. Known received bodies total 3,433,801 bytes. The old report omitted the charged protection-probe response from its receipts, so complete received bytes are unknown; reservations remain charged.
- First authenticated read 1,557 ms; subsequent sequential warm read 255 ms. Other burst reads ranged 270–1,068 ms. These are client-observed HTTP durations, not billed CPU or game-to-display latency.
- Zero Redis requests, ESPN requests or notifications. The per-fill file store cleanup is in finally. Run-specific tag invalidation returned 200.
- The temporary Preview was deleted through the existing CLI. A subsequent Vercel API lookup returned **Deployment not found(404)**. Automatic 30-minute expiry was configured/unit-tested; the deployment was removed earlier, so hosted expiry itself was not observed.
- Fresh preflight usage UI showed 20m40s/4h Fluid CPU, 3,820/1M invocations, 1h/100h builds, 135.78MB/100GB fast transfer and 106.64MB/10GB origin transfer. This admitted the small test; it is not public-capacity evidence. CLI billing-cost data was unavailable. Per-run Vercel billed CPU/cache units were not exposed in the captured logs and remain unmeasured.

Secret-free controller receipts, durable ledger, scoped logs, removal evidence and summary remain in private `outputs/v086/phase18/`. No authentication token was printed or committed.

## Corrective work and next decision

The controller now requires consistent model/snapshot/input identities and resume facts across warm reads. Cache-fill IDs measure actual amplification instead of being mistaken for model identity. It still requires observed reuse and stops if resume data differs. It records packet observations before assertions, retains partial metrics on failure and includes the unauthenticated probe's receipt. A targeted regression accepts multiple fills with identical facts and rejects changed records under the same diagnostic scenario.

This is a correction to the test's unsupported strong cache assumption and its evidence capture, not a claim that cross-worker cache cost has been fixed or that the hosted test passed. The production adapter/model were not changed to hide the finding. Capacity estimates must allow cold-worker/region amplification and retain operating limits; no universal hit rate is assumed.

**Decision:** no public release approval is requested. One corrected protected canary, under the SAME limits and with a NEW explicit deployment approval, is the shortest remaining verification step. It should complete the remaining cache/replay/UI checks without another Redis benchmark or model expansion. The previous one-deployment authorization is consumed.

After that passes, prepare only 2026 confirmed Team Resumes and explained Movers & Losers, separate from official polls, with the existing-feed confirmed-result hookup. Latest confirmed, timestamped evidence is the fallback if live freshness or recurring costs remain blocked. Brackets, probabilities and public activation stay excluded until separately approved.
