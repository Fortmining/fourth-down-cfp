# Kickoff incident — OPEN

Tracking: https://github.com/Fortmining/fourth-down-cfp/issues/5

The October 22 App State–James Madison game (ESPN 401869845) was followed at 3:55:33.832 PM EDT in the installed iPhone's retained worker preferences, before 7 PM kickoff. No kickoff claim or provider acceptance survives. The final was accepted at 11:08:00.809 PM and acknowledged after browser display at 11:08:03.213 PM. The user found the final. That verifies final delivery through temporary following and the existing Apple subscription; it does not explain the missing kickoff or establish historical closed-app state.

The latest server settings write (9:44 PM) is not the first synchronization timestamp. v0.6 removed completed server follows and did not retain feed transitions/settings revisions. Its historical runtime logs expired. The historical cause is unproven. Do not close this issue based on simulated tests, inspection UI, or successful final delivery.

## Code findings

- Four-minute QStash checks invoke the existing production dispatcher. ESPN fetches use 60-second revalidation; the public live response also advertises 60-second shared caching and 120-second stale-while-revalidate. The dispatcher calls the live handler directly, so public response caching is not an additional dispatch cache. `updatedAt` is response assembly time, not ESPN publication time; it cannot establish source freshness or actual kickoff time.
- Detection requires a prior `pre` and current `in`, two teams, and provider status `STATUS_IN_PROGRESS`, `STATUS_HALFTIME` or `STATUS_END_PERIOD`. Scheduled time must have passed. Being scheduled alone never triggers an alert.
- A previous snapshot over five minutes old suppresses all transitions. One missed four-minute check can cross that cutoff. Current snapshots older than three minutes, future or nonadvancing timestamps, initial baselines and season changes also suppress detection.
- Replacing a baseline with a feed missing a game loses that game's scheduled comparison. The next live observation does not trigger kickoff. A scoreboard outage can produce such an incomplete feed while rankings remain available.
- An explicit live state arriving before its scheduled timestamp is suppressed. Subsequent live→live checks cannot recover kickoff. Unknown live statuses can similarly consume the scheduled comparison. These are demonstrated limitations, not established explanations for this incident.
- A local watchlist entry is not proof of server eligibility. Push controls and an existing active subscription must exist; the worker must persist preferences; unrelated unsaved notification settings defer the server update until explicit Save. Following alerts must be enabled separately. At dispatch, follow creation/expiry, matching game/team, category activation and duplicate claims all affect eligibility.

This release exposes these existing decisions without changing the catch-up policy, permission choices, four-minute schedule, permanent favorites, ranking alerts, or event IDs. Tests reproducing a suppression document a remaining limitation; they do not claim to fix it.

## Evidence captured from this release

- A run ID correlates feed observation, polling/baseline ages, feed warnings and scoreboard availability, per-game prior/current ESPN state, event detection, eligibility, filtering, duplicate claims and provider result. Delivery failures identify receipt-storage, provider-send or acceptance-storage stage.
- Scheduler history records each completed check, failure stage and lock skip. Feed transitions are recorded independently of subscriptions, including games whose local follows never synchronized. Unchanged game states are captured within 30 minutes of scheduled kickoff. Subscribed games also record every check within six hours of kickoff, plus state changes/missing games.
- Per-device/game observations preserve server settings time, following enabled, matching follow creation/expiry, favorite matches and category activation decisions. Existing settings history records actual server writes and cleanup snapshots. Reread-before-send outcomes are recorded separately from the earlier scan snapshot to identify races.
- Client synchronization retains the last ten started/outcome attempts locally. Capability-authenticated, same-origin telemetry records terminal stages and the then-current server follow snapshot. Offline failures remain local and are included by Inspect this device. Client-reported times/stages are labeled separately from authoritative server saves. Telemetry cannot grant permission or create subscriptions, and its failure cannot block a successful save.
- Protected diagnostics accept `gameId` and optional `historyLimit` (default 100, maximum 2000). Responses include scheduler history filtered to that game's state, per-device game history, sync/settings history and existing receipts. No endpoints, push encryption keys, capability tokens or token hashes are logged.
- Storage is bounded: 2,000 observations per device/game, 24,000 scheduler entries, 200 settings/delivery entries per device. Keys expire after 30 days of inactivity; entry caps may evict older history sooner. `lastCheck.diagnosticsHealthy=false` exposes audit failures. Logging/storage outages remain an explicit evidence limitation.

## Acceptance and diagnosis

Regression fixtures cover four-minute scheduled→live transitions with follows created three hours before kickoff; small jitter and skipped checks; delayed live updates; missing/repeated/stale/future feeds; unknown/canceled/postponed states; activation/opt-in filtering; offline/deferred/failed synchronization; and overlapping favorite/follow notifications. Existing final, ranking, schedule, worker and deduplication suites remain required.

After deployment, inspect naturally scheduled production checks for real persistent run records and unchanged subscriptions. Do not inject events, replay the game, or send test notifications to the production device. A real kickoff display receipt is separate from these regressions and is still pending. Keep issue #5 open until a real occurrence yields a supported cause and any needed fix is verified.
