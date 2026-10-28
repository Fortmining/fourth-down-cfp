# Phase 9 recovery — freshness handoff and compact private checkpoint

**Public release: NO-GO. No deployment or production change.** This follows saved commit `4ba5895`, which already completed private source-to-history-to-browser integration and 354 tests. Recovery found a clean, aligned branch and an open, draft, unmerged PR #19. No unfinished Git, build or test operation was found; existing private preview servers were still running. The completed single hosted benchmark was not repeated.

## New correctness fixes

An unchanged result signature previously allowed the handoff to skip the independent engine even after its persisted freshness had expired. A healthy notification fetch is not evidence that the resume engine checked the same capture. The skip now requires a ready committed signature **and a current saved observation receipt**. Feed equality alone cannot extend freshness.

Signatures cover the full confirmed evaluation inputs, schedule corrections and unresolved fixture evidence. They ignore live score/clock churn, source observation metadata and refreshed records embedded in an unchanged published poll. A schedule/conference/evidence correction cannot silently bypass reconciliation.

Freshness uses the source observation time, not the later transport receipt time. A delayed response cannot buy an extra six minutes of apparent freshness. Old, invalid, incomplete, expired or conflicting inputs still use the guarded withholding path; confirmed history is preserved.

## Compact injected persistence candidate (protocol 2)

The original full-state tick remains available privately but is not a sustainable polling design. `ResumePipeline.ingest` accepts an already-captured complete input; it validates that input before attempting a compact signature check. A matching ready head renews only a small freshness receipt. A changed signature goes through full reconciliation, versioned history and explanation generation. No network source fetch, notification import, timer or production dispatcher hook is installed.

Four private declared keys are used: state, meter, display and head. The compact head contains protocol version, authoritative state digest, confirmed input signature, status and checked observation time. Redis checks the actual state digest and presence of the materialized display before renewing. Display reads verify the state/display/head identities together. Partial writes fail closed. A full-state writer cannot move a newer freshness checkpoint backward.

The displayed record/history payload is not rewritten during an unchanged check. The display value has bounded 35-day storage expiry, with a separate six-minute observation-age gate; storage retention must not be confused with current-data freshness. Existing 32-receipt / 4 MiB history and 8 MiB state bounds remain. Expired or missing materialization requires guarded rebuilding.

No transparent retry follows an ambiguous compact write, quota denial or storage failure. A later independently verified capture may retry. Test ports simulate the protocol: they do **not** execute Lua or prove Upstash support, cross-instance quotas, physical memory or hosted CPU.

## Cost correction and sustainable candidate

The planner now includes inactive-period freshness work. The former roughly 45K/month illustration omitted that work and must not be used as admission evidence. The legacy full-state path alone reserves 28 commands per check: at 360 checks/day that is **302,400 commands/month**, before meaningful updates and visitors, and transfers the retained state repeatedly.

Protocol 2 conservative per-operation reservations, including EVAL and nested commands:

| Operation | Commands | Mutations |
|---|---:|---:|
| Full-state read | 5 | 1 |
| Commit state, display and head | 9 | 4 |
| Compact verified freshness | 7 | 2 |
| Materialized display read | 7 | 1 |

These are code-path reservations, not provider invoice measurements. Denied requests still have provider overhead; the absence of transparent retries does not make unsuccessful requests free. Real transport deadlines, admission, multi-worker cache behavior and actual failed-request costs need protected validation.

Illustrative compact scenario: the existing 360 daily checks, 70 meaningful updates/week, **50 shared display misses/day**, 30-command/17-mutation allowance per meaningful update, and previous sealed 32-entry local sizes (756,628-byte compressed/base64 state; 58,260-byte display). This reserves about **95.1K commands/month**, **28.2K mutations/month**, **1.24 GB/month** of value-body/overhead transfer and **4,670 commands on a peak day**. These fit candidate bounds narrowly; they are not measured public traffic or total-account headroom. At 100 misses/day the command scenario exceeds the 100K candidate monthly bound. Each actual Lua call reserves before mutating; exhausted allowances withhold results rather than permit unbounded successful work.

The 50-miss assumption is not a visitor capacity claim. The public cache/transport is not connected, and per-process throttles do not establish a distributed visitor limit. No production activation is granted by the planner, even when a scenario fits. CPU inputs are explicit planning assumptions; previous benchmark measurements do not cover this new protocol. Physical storage and a representative complete-week account baseline remain unknown.

## Validation and remaining decision

**366 automated tests pass**, plus production build, lint and type checking. Chromium, Firefox, desktop WebKit and iPhone-sized WebKit pass controlled replay, layout and accessibility checks; these are browser emulations, not physical-device delivery tests. Final automated and browser results are recorded with PR #19 and in the private `outputs/v086/phase12/` artifacts. New regressions cover unchanged inactive periods, missing/future/expired receipts, schedule corrections, delayed transport timestamps, compact shared display, missing/partial heads, old writers, ambiguous renewal and full/compact operating scenarios. Real captured archived fixtures remain separate from controlled fault simulations.

**Ready for private review:** the local confirmed-result → retained snapshot → explained movement → cached fan display flow; guarded compact freshness candidate; full-state fallback; bounded offline admission and replay.

**Still blocked publicly:** hosted protocol-2 execution and failure behavior; safe actual current-season ledger bootstrap/producer integration; measured account-wide admission, physical storage, cold-start CPU and cache demand. No production schedule, credentials, subscriptions, preferences or AP tied-rank notification issue #21 changed.

The next approval, after reviewing this evidence, is a separately bounded protected **protocol-2 integration** validation. It needs a concrete command/mutation/read/cleanup cap, isolated expiring keys, least-privilege temporary Preview access, disabled production side effects and cleanup, just as the earlier benchmark did. The earlier one-deployment approval cannot be reused. No merge or public activation is recommended.

Recovery validation note: standalone type checking encountered three duplicate generated `.next/types/* 2.ts` files. They were byte-identical to the normal generated declarations and were preserved outside the build cache with a hash manifest. No tracked application source was removed or changed for that repair. The cause of the duplicate cache files is not established.
