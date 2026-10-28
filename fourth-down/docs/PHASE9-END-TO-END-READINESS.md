# Phase 9 — private end-to-end integration and release readiness

**Follow-up:** [Recovery and compact freshness protocol](PHASE9-RECOVERY-AND-FRESHNESS.md) supersedes this report’s three-key protocol and resource estimates. The old ~45K command scenario omitted recurring durable freshness work and is not an admission estimate. This report preserves the evidence from commit `4ba5895`; use the follow-up for current readiness.

**Recommendation: NO-GO for public activation.** The source → confirmed evaluation → retained history → cached fan display flow now works in private offline replay. The new shared Redis protocol is implemented as an injected candidate, but has not run on hosted Redis or Vercel. That distinction matters: the earlier approved benchmark did not exercise this new protocol or dispatcher integration.

**Validation:** 354 automated regression tests, lint, type checking and production build; final status is recorded in the PR report. Chromium, Firefox, desktop WebKit and iPhone-sized WebKit passed the private integration browser checks. All new Redis failures are injected simulations.

No deployment, production configuration, credential, schedule, notification, subscription or service-plan change occurred in this phase. PR #19 remains draft and unmerged. The previous protected benchmark was not repeated.

## Implemented private flow

- `captureResumeUpdate` reuses the existing ESPN game, standings and poll adapters over an already-fetched scoreboard plus a complete season ledger. It makes no network request. Known finals survive a transient live/pre-game regression. Missing/invalid finals, participant conflicts, wrong seasons and fresh record disagreement are withheld.
- Old aggregate records that predate a newly confirmed final are retained in their original archived seed; the new receipt derives current overall/conference records from the complete verified game ledger. A fresh disagreeing aggregate is not silently replaced.
- A confirmed-change gate can reuse the two feeds already held by the dispatcher. It requires fresh no-store source evidence, and does not import or run notification delivery. No timer or production hook was installed.
- The handoff must compare with the engine's **committed ready checkpoint**, not just the prior notification feed. Otherwise a failed engine update could be skipped forever once the source stopped changing. Tests cover retrying this case and revalidating a withheld committed head.
- The coordinator versions source receipts and model/input identities, recomputes the whole team universe for a meaningful change, and atomically commits retained history and its display. Non-final clock/score changes do not create confirmed history. Live leader assumptions are excluded from this limited pipeline.
- Official poll identity uses publication ID/date/season and published team positions/arrows. A refreshed embedded win-loss record alone does not rewrite the saved edition or become a new poll. Changed published positions under the same edition identity are withheld. The production AP notification issue #21 was not modified.
- The last 32 receipts remain ordered. Movement uses the actual retained predecessor. An absent/evicted receipt does not select an arbitrary fallback. Historical views can be requested privately by receipt ID.
- Source staleness, expired anchors, overdue unconfirmed games, missing/conflicting records, corruption, incompatible membership and budget failures preserve the confirmed head and withhold current ordering/movement. Last-known records are explicitly labeled.

## Persistence, cache and recovery

The private file adapter uses a checksummed state envelope, exclusive writer lock, temporary file, fsync and atomic rename. Tests cover failure before rename, lost acknowledgement after rename, restart/deduplication, competing coordinators and old worker failures that must not poison a newer head.

The injected Redis candidate uses three declared private keys: state, meter and materialized display. No environment variable or HTTP credential transport is installed. It validates the private namespace, meters EVAL and nested commands before mutations, uses compare-and-set state identity, compresses bounded values and makes no transparent retry after an ambiguous commit.

A separate compressed display avoids sending the full retained archive to ordinary cache reads. Its receipt includes the authoritative state digest; a partial state/display write cannot serve an old view as the new state. A later verified update can repair the materialization. **Lua isolation is not described as rollback:** runtime errors can leave partial writes, and the digest check is specifically needed to fail closed.

The file-backed local cache has a 15-minute maximum and a six-minute source-verification boundary. Valid unchanged checks can renew the hot cache without new model history. Cache expiry, stale sources, missing shared display and recovery are tested. Hot request/byte limits are per coordinator, not a claim of distributed Vercel-wide enforcement. Shared display reads always verify the authoritative state digest instead of trusting a worker-local cached view after another worker commits. The Redis meter is the shared enforcement candidate and still needs hosted validation.

## Evidence: real captured inputs versus simulations

1. **Genuine archived input replay:** the October 5 → October 19, 2025 fixture reproduces Notre Dame +28 resume positions and Tennessee 5–2, while keeping published polls separate. These are saved captures, not new source events or forecast-accuracy evidence.
2. **Captured 2026 universe:** the existing 138-team/888-fixture input reaches the same coordinator, including Tennessee 6–2 overall / 3–2 conference. This is a captured-data test, not a newly fetched live record.
3. **Controlled scenarios:** consecutive results, multiple near-simultaneous finals, duplicates, delayed observations, stale/missing/conflicting inputs, corrections, official edition replacement, expired anchors, retention eviction, source aborts, quota exhaustion, corrupt state, restart, concurrent CAS and partial cache commits. Simulated failures are labeled as such.
4. **Private source-to-browser replay:** file change → coordinator → persisted history → cached HTML → Movers & Losers passes Chromium, Firefox, desktop WebKit and iPhone-sized WebKit, including 320/390/430/1280px layouts and accessibility checks. An incomplete refresh withholds movement; restoring a valid duplicate recovers without another history entry. The current 2026 saved view remains separate from the integrated archived replay.

Local review: http://127.0.0.1:3018/ . Select **Archived 2025 movement replay** to inspect the integrated history comparison. `/view.json` includes pipeline metadata; `/history.json?id=<retained-receipt>` returns the chosen archived view. All routes are loopback-only, no-store and noindex. This is not a deployed application feature or physical-iPhone test.

Profiling artifacts are sealed with a SHA-256 of the exact state bytes. An earlier mutable report/state mismatch was found; that unsealed artifact is not used for this assessment. The fresh isolated run verifies each committed revision and its final sealed state.

The initial browser check exposed a stale keep-alive connection reset; its read-only polling now has bounded retries and connection-close requests. A second run showed that repeated full payload polling and a four-second wall deadline were unsuitable under concurrent local build/test load. The harness now polls small status metadata, and the private update deadline is bounded at 15 seconds. Assertions were not weakened. Final browser checks pass. No notification timing was changed.

## Operating limits implemented, not activated

| Candidate bound | Value |
|---|---:|
| Retained receipts / logical history | 32 / 4 MiB |
| Complete private state | 8 MiB |
| Source age / update deadline | 6 minutes / 15 seconds |
| Core daily ticks / meaningful updates | 400 / 60 |
| Shared-display misses per day | 300 |
| Candidate command reserve per day / month | 5,000 / 100,000 |
| Candidate mutation reserve per day / month | 2,500 / 50,000 |
| Shared value-body transfer reserve per day / month | 250 MB / 2 GB |
| Per-coordinator hot display requests / bytes per minute | 60 / 16 MiB |

The shared script reserves five commands/one mutation for state reads, six/one for display reads, and seven/three for commits, including EVAL itself and internal commands. Base64 values plus 16 KiB bounded script/JSON overhead are reserved before transfer. These are conservative protocol allowances, **not actual Upstash invoice measurements**. Denied requests and unavailable storage cannot produce a successful fan view. No unbounded pipeline or deferred write is used.

These module caps protect the new workload; they do not establish total-account headroom. Representative baseline and admission evidence are still required before activation, and the operating planner always withholds a production activation grant.

## Measured local costs and explicit assumptions

- Genuine two-update replay: 776,194-byte local state; 1,867 ms total process CPU across baseline, updated result and duplicate/display steps. Contended wall time was 14.6 seconds across all three steps. This is local CPU/filesystem evidence, not Vercel billing.
- Full 32-entry retention profile: **controlled local score-correction cost simulation**, using the real captured universe with invented test corrections. All 34 receipt updates completed; 32 retained. Local file 1,380,472 bytes, compressed/base64 state 756,628 bytes, separate display 58,260 bytes. Total local CPU 25.457 seconds / elapsed 80.406 seconds. It is neither a real-event test nor an as-of forecast replay.
- This phase made **zero Redis calls, zero QStash deliveries and zero additional ESPN requests**. The previous hosted measurements remain valid for their earlier workload only; no paid monitoring was purchased.

Illustrative weekend assumptions: 70 meaningful updates/week, up to 60 on a peak day; the existing 360 checks/day are retained, with unchanged verified feeds gated before private model work. At 100 application cache misses/day, the high-level reserve is about **45K commands/month**, plus any still-unvalidated checkpoint/freshness handoff work. At 300 misses/day the plan reserves about **117K**, exceeding the 100K candidate monthly cap. These are scenarios, not traffic forecasts.

At the full-retention measured sizes, two read/commit transactions per update imply roughly 3.2 MB of body/overhead reservation per update. Around 300 updates/month plus 100 display misses/day is approximately **1.2 GB/month**, before checkpoint/cold-start variation. Peak 60 updates plus 100 display misses is approximately 201 MB/day. These fit the *candidate* 2 GB/250 MB bounds in this simulation, but do not establish real provider cost or total-account safety. Full-history diversity, gzip size, retries and cache behavior can differ.

A per-poll checkpoint/freshness read must not silently transfer the full history, recompute the model, or be assumed free. Its hosted cost and inactive-period freshness behavior remain explicit integration gates. The real five-day account dashboard from the earlier phase is not a complete representative week. Physical Redis memory, current total Vercel CPU allowance usage, distributed cold starts and real cache-miss demand remain unknown.

## Readiness and next decision

**Ready privately:** confirmed-source adapter; complete record reconciliation; versioned receipt/history and explanations; deduplication; stale/conflict withholding; local atomic persistence/recovery; retained historical views; compact fan UI; and injected shared Redis/CAS/display protocol with simulated fault tests.

**Not ready publicly:**

1. The new shared Lua/CAS/quota/materialization protocol has not executed on hosted Redis/Vercel. Simulated protocol tests do not establish provider syntax/support, billing, network ambiguity or multi-instance behavior.
2. The actual current-season producer/checkpoint/freshness handoff and full ledger bootstrap are not connected to the production dispatcher. No automatic production updates are claimed. Private integration must be validated across an inactive period, a confirmed change and recovery, outside the notification critical path.
3. Complete-week account admission, physical storage/cold-start CPU and actual traffic/cache-miss costs remain unverified. Do not activate with a saved capture or arbitrary headroom assumption.

Recommendation: review the new private integration, then separately authorize a bounded protected **integration** validation of this new code. That is a different workload from the completed benchmark and requires a new deployment approval. Keep PR #19 draft and unmerged. No public bracket, named qualifiers or numerical probabilities are proposed.
