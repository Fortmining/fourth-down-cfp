# Corrected protected canary: PASS, removed

The explicitly approved corrected controller from `90d7ecb` completed one protected Preview in the existing project. Deployment `dpl_DJxFms1s7NBbkpRGZr8mQp3CCYqV` is removed; the provider lookup returned 404. No production configuration, credentials, subscriptions or schedules changed. No new access was provisioned.

## Observed evidence

- 39 metered requests: 16 API, 4 pages (including protection probe), 18 assets, 1 cleanup. Concurrency at most four; no HTTP retries or redirect following. 19,415,040 reserved response bytes; 8,586,994 acknowledged response bytes. The ten-minute window and 64-request/32-MiB ceilings were respected.
- Zero Redis requests, source/ESPN requests or notifications. All data changes were **controlled 2026 replay**, including a synthetic final; they are not real-event delivery or latency evidence.
- Six warm reads returned identical semantic identities and facts, using one distinct fill in this sample. This is observed reuse, **not a global single-fill guarantee**. The earlier canary observed two fills for six reads; capacity must allow amplification.
- Before/after confirmed snapshots, two retained history entries, explained movement, duplicate suppression and stale-source withholding passed. Negative-cache reads, 60-second refresh and tag invalidation passed.
- Hosted desktop and iPhone-sized Chromium rendering, no horizontal overflow, and automated WCAG checks passed. This is not a physical iPhone test.
- Observed process CPU for three replay/cache fills: 1,097.021, 1,966.081 and 792.615 ms; elapsed 1,016.396, 1,934.309 and 792.379 ms. These samples are **not Vercel billed CPU**, entire-handler CPU, normal cached-display CPU or game-to-display latency. Billed CPU and billed cache units were unavailable, not observed failures.
- Fresh preflight UI showed 20m48s/4h Fluid CPU, 3,845/1M invocations, 1h/100h builds, 136.09MB/100GB fast transfer, 107.19MB/10GB origin transfer and 1GBhr/360GBhr memory. This admitted the small test; it is not a measurement of public traffic costs.

## Cleanup and interpretation

Run `63dc8182bbcf517a95ee3a1f` invalidated its tag (200); temporary fill files were removed in finally. The Preview was deleted and provider 404 verified. Automatic expiry was configured, but early deletion means hosted expiry was not observed. Private receipts, ledger, screenshots and removal evidence are in `outputs/v086/phase19/`; no authentication material is committed.

The failed first canary remains documented in PROTECTED-CANARY-RESULTS.md. This corrected run completes its previously unreached hosted movement/cache/UI checks. Neither canary proves the final production Redis+feed hookup as a single hosted system; the separately passed hosted Redis test and targeted local integration cover those parts. No additional Preview is authorized.

**Recommendation:** proceed with the isolated, gated, confirmed-results release candidate and final production approval. Exclude live provisional movement, bracket projections and probabilities. Preserve dated confirmed evidence when source reconciliation fails; never relabel it current just because a visitor loaded it.
