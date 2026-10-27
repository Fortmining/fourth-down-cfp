# Résumé preview review — October 27, 2026

## Review artifact and evidence

Private loopback preview: `http://127.0.0.1:3014/`. Generated with `scripts/resume-preview.mjs` using `SHADOW_SEED`, optional `SHADOW_PREVIOUS`, and `SHADOW_PREVIEW`. No production route imports `fan-resume.ts`, and no writer or schedule is installed. This is a captured review, not a live public service. The source timestamp and archived status remain visible.

2026 source capture: **2026-10-27T11:01:36.560Z**, compared with the previously saved **2026-10-26T22:07:01.854Z** input. Both contain 138 teams and 888 fixtures. Confirmed ledger coverage is complete; future coverage remains incomplete. No invented movement is shown where the comparable captured evidence did not change. The manual capture made three source requests; it did not change the notification fetch policy or cadence.

The archived review compares October 5 and October 19, 2025 genuine input vintages using the previously versioned replay fixture. No future outcomes are copied into an earlier vintage. This is a retrospective test of a model developed later, not a forecast published in 2025. Representative cases are selected deterministically, not by changing weights for those teams:

| Review case | Archived example | Record | Résumé order change |
|---|---|---|---|
| Requested team | Tennessee | 5–2 | Same place, evidence updated |
| Improving | Notre Dame | 5–2 | Up 28 |
| Declining | Michigan | 5–2 | Down 11 |
| Conference race | Ohio State | 7–0 | Same place |
| Bubble discussion example | Texas Tech | 6–1 | Down 2 |

Improving/declining examples are the largest moves among the current top 35 in this replay. The bubble example is the first unselected team in testing résumé positions 10–18. This is a **UI discussion example**, not validated bubble membership. No projected selection or championship participation is asserted. The 2026 review shows Tennessee (6–2 overall, 3–2 conference), Miami (7–0), and Texas Tech (6–1). Use the evidence selector to see all five historical situations; the two seasons are never blended.

## Proposed wording and fan-facing method

- **What helps:** confirmed wins and leading wins by the opponent-record comparison, with exact final scores and game links.
- **What needs work:** confirmed losses, the loss to the lowest verified opponent-record index, multiple losses, and unavailable opponent evidence. A loss is not called an elimination.
- **Why the résumé changed:** direct results, revisions, changed opponent records, published-poll effects, or relative order changes. An unchanged position can still have new results and a changed underlying résumé.
- **Remaining games:** known scheduled fixtures, opponent records, captured published ranks where available, and whether the result also changes the conference record. Dates are shown in Eastern time. The ledger does not preserve kickoff-time verification, so times are explicitly unverified rather than displaying midnight placeholders. Unassigned conditional slots and incomplete schedule coverage stay labeled.
- **Conference record order, ties kept:** a comparison of conference win percentages, not an official resolved championship standing. Conflicting peer records withhold this comparison.
- **Official AP / Coaches / CFP:** published positions and dates with official poll arrows separately labeled. These arrows never derive from a game result.
- **Conditional scenarios:** rule-only conditions and separately labeled supported live assumptions. No named qualifiers, definitive bracket or numerical playoff probabilities.

The testing résumé uses 35% overall record, 35% result credit, 10% opponent-record index and 20% published polls. The prior engine and weights are unchanged. The opponent index is `(wins + 1)/(games + 2)` excluding head-to-head results; it is not official SOS. It does not fully adjust for the opponents' own schedule strength. Leading win/loss comparisons therefore describe a reproducible limited method, not committee intent. Missing opponent evidence is not fabricated. Raw additive scores and score decomposition are absent from the primary team cards; detailed methods are expandable.

The current-capture label becomes archived as it ages, and unsupported live assumptions disappear. Eligibility unknown remains unknown. No live provisional result replaces a confirmed record. Search, representative-case buttons, expandable result/schedule details and a Show all teams control limit unnecessary mobile scrolling.

## Hosted resource-budget evidence

Read-only native dashboard measurements taken October 27; no resource configuration or production writes were made by the measurement:

| Existing hosted workload | Measured value |
|---|---|
| Redis commands | 55,331 / 500,000 monthly (32,460 writes, 22,871 reads) |
| Redis storage | 28 / 250 MB |
| Redis bandwidth | 806 MB / 10 GB |
| Redis displayed cost | $0.00 |
| Redis daily commands, UTC chart | Fri ~4.9K, Sat ~19K, Sun ~14K, Mon ~11K, Tue partial ~4.8K |
| Fourth Down Vercel last-30-day active CPU | 17m 45s |
| Fourth Down memory / invocations | 0.87 GB-hours / ~3.2K |
| QStash last 24h | 360 created, 360 delivered, 0 errors, 0 failures |
| QStash last 7d | ~1.8K created/delivered; 1 error and 1 failed message |

The Vercel display window was Sep 27 5am–Oct 27 5am (dashboard zone unspecified); usage can lag one hour. Redis daily chart is explicitly UTC. QStash chart explicitly displays UTC−04:00. Rounded totals are not exact daily reconciliations. Aggregate QStash metrics do not identify the cause of the historical single failure. A separate small protected verification read confirmed the current scheduler healthy with zero failures in its latest run.

This includes real game-day traffic and is a **hosted baseline**, not an incremental hosted engine benchmark. The existing local retention measurement (~10.36 MB for 384 retained pairs, reserve 20 operations per meaningful pair) remains a local simulation using actual payloads. Local CPU estimates must not be presented as Vercel bills. Visitor cache misses, hosted Lua command billing and retries remain unmeasured.

Three completed days (Sat–Mon) total roughly 44K commands. Extending that mix to 30 days would be ~440K before engine work, leaving only ~60K; this is a sensitivity scenario, not a prediction. Repeating the Saturday peak would exceed 500K even without the engine. An always-changed model at 360 checks/day would reserve 216K commands/month for writes, plus 10.8K head reads and visitors; that design is not admitted by this evidence. Reuse existing fresh inputs, avoid a new schedule, write confirmed semantic changes only, cap retention/read demand, and reserve notification capacity first. No such integration was activated.

A broad diagnostics history read (`historyLimit=2000`) returned HTTP 503. It was not repeated or treated as successful historical measurement. The normal small health read succeeded. No production fix is bundled into this UI review.

**Recommendation:** review the UX, while keeping the engine private. Current baseline usage alone does not justify public activation. A separately isolated, bounded hosted engine benchmark is still required to measure incremental CPU, command billing, retries and visitor demand without touching notification keys or production behavior. This report does not claim that benchmark has occurred.
