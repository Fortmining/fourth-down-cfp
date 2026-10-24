# Fourth Down v0.8.3 — Permanent-favorite controls and delivery evidence

## Missing permanent-favorite controls

The notification page filtered Close game and Scoring updates out of the Favorite teams section, although normalization, persistence, server eligibility and worker selection already support those independent favorite opt-ins. Both controls are now visible. Saved values are retained exactly: making a control visible does not enable it. Explicit Save Changes is still required, with existing server-confirmed success, retry and draft guards.

Scoring updates are verified scoreboard increases, not detailed drive summaries. The existing ten-minute interval and other notification budgets remain. Close alerts retain the eight-point/final-five-minutes/overtime gates. Favorite and temporary-follow choices remain separate.

## Kickoff delivery diagnostics

A provider acceptance or an inbox entry is not evidence that a phone displayed a notification. Notification History still explicitly records generation, not display confirmation. The permanent-favorite association and opt-ins must be checked separately from temporary follows.

Kickoffs now request high transport urgency, with the same bounded event expiry and deduplication. This mitigates queueing risk when a feed confirms kickoff near the existing expiry; it does not establish the cause of a historical missing banner or guarantee delivery. The protocol distinction is specified in [RFC 8030 section 5.3](https://www.rfc-editor.org/rfc/rfc8030.html#section-5.3).

Provider attempts record remaining TTL, urgency, expiry and matched favorite choices. A bounded, compact per-device/game audit retains delivery and worker outcomes beyond unrelated game traffic (300 entries, 30-day inactive TTL). Filtered events are archived only for matched permanent favorites, avoiding per-game archives for every unrelated score. Diagnostics also search the existing 200-entry generic audit for older matching evidence.

Updated workers report arrival and terminal outcomes: displayed, expired, locally unselected, duplicate, storage-failed or display-failed. Reports include only bounded boolean scope evidence, worker revision/platform, open client count and client receipt time. No push endpoint, encryption key or device control token is added to audit records. The arrival request runs alongside local processing and cannot delay showing a valid alert. Non-display outcomes never update verified-display state. Existing old-worker display receipts remain supported. Non-display reports use a separate endpoint, so a rollback cannot misinterpret them as legacy display receipts.

No favorite or temporary-follow preferences are enabled automatically. Existing subscriptions, claims, final/ranking/Pulse rules, cooldowns, expiry windows and scheduler remain unchanged. Historical missing kickoff display remains unconfirmed where the older worker did not provide suppression/arrival evidence; do not close issue #5 based on these changes or simulated tests.

## Validation and limits

Regression coverage includes permanent-only Tennessee eligibility and worker selection for all five requested game types; server persistence and reused subscription; high kickoff urgency with unchanged TTL; worker outcomes and rollback-safe reporting; telemetry that cannot delay display; per-game history surviving unrelated traffic; favorite controls on mobile with failed save/retry, explicit save, server/worker persistence and reload; existing notification, ranking, Pulse and Watchlist flows.

Browser/API/worker fixtures are simulations. Physical iPhone delivery and OS banner presentation require real-event evidence. A browser display receipt proves showNotification completed, not that the user saw a banner.
