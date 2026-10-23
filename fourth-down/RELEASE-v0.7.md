# Fourth Down v0.7 — optional game notifications

Issue #5 stays OPEN until real kickoff display evidence is confirmed. v0.6.2 bounded kickoff recovery was implemented and deployed first (PR #7, production commit 2555b3c7f27e6831cba4d5ce9ab8e0bbc3101188). It recovers from a durable pregame witness within 12 minutes of scheduled kickoff, with identity, progressed first-quarter clock, freshness, server opt-in timing, expiry and existing event claims. Its 94 regressions and naturally scheduled healthy checks are not real kickoff evidence. See KICKOFF-INVESTIGATION.md for conservative exclusions.

## Controls and migration

More → Notifications contains independent permanent-favorite and temporary-follow sections. Favorites offer kickoff, final, halftime, Upset Watch and Confirmed Upset. Temporary follows offer those plus Close Game and optional Scoring Updates, with individual kickoff/final switches. Every new type defaults off. The existing following master opt-in retains kickoff/final defaults, and existing permanent teams, push capabilities, subscriptions, category choices and AP/Coaches/CFP publication settings are preserved. Changing a choice is local until explicit Save/Enable; no automatic permission prompt or subscription creation is added.

## Rules

- **Halftime:** ESPN reports in-progress STATUS_HALFTIME, period 2, clock 0 and valid scores. Require a known game; do not send cold-start historical halftime notices.
- **Close Game:** explicit live Q4, clock from 0 through 300 seconds and margin ≤8; or explicit overtime (period ≥5), regardless of margin. Missing/invalid clocks or scores mean no alert.
- **Upset Watch:** same late Q4/OT window; a published AP top-10 team faces an unranked team or one ranked ≥10 places lower. The underdog is leading, tied, or trails by ≤8. This is a threshold, not an estimated probability.
- **Confirmed Upset:** a completed ESPN STATUS_FINAL/STATUS_FINAL_OT with numeric scores and a confirmed underdog winner against that significant ranked opponent. Shares the existing final event ID so overlap with final/legacy breaking-upset alerts sends one push.
- **Scoring Update:** a monotonic observed score increase in a verified live game. First-load scores and downward corrections do not produce updates. Multiple scores between four-minute checks may combine; this does not claim every scoring play was observed.

New upset types use AP only: current season, published date not in the future or >8 days old, complete unique top 25. Freeze the edition/ranks from pregame or the first observed first quarter. Include AP edition in the alert. Do not silently substitute Coaches, CFP, projections or unlabeled provider ranks. Missing valid AP data suppresses new upset types without blocking other alerts. The preexisting global breaking-upset choice retains its provider-ranked final rule for compatibility; it is distinct from the new scoped AP types.

All optional game alerts require a fresh assembled feed (≤90 seconds), available scoreboard, numeric identity and actual ESPN state/period/clock/scores. A live game timestamp must be valid, not future and within eight hours. A final/canceled terminal state cannot reopen on a subsequent bad live snapshot. Assembly time is not an independent ESPN publication timestamp; upstream errors remain possible.

## Identities, expiry and volume

- Existing kickoff and final: game:<id>:kickoff / game:<id>:final.
- Halftime: game:<id>:halftime, once per device/game.
- Close and Upset Watch: game:<id>:late:fourth or :late:overtime. Eligible tactical types coalesce into one push; at most one tactical notification per phase per device. If close already notified a subscriber, a later watch in that same phase does not generate a second push. An Upset-Watch-only subscriber can still be selected when the threat first emerges.
- Scoring: sorted team IDs and exact observed score pair form the identity. Corrections/repeated snapshots cannot duplicate a previously claimed score update.
- Optional candidates expire five minutes after first observation (a newly emerging tactical type opens its own opportunity on the same phase identity). Category enablement, server route-save timing and follow creation/expiry are checked against the event time, against the opportunity’s event time. A newly emerging tactical type can refresh an unsent phase opportunity; a phase already delivered to that device stays claimed.
- Scoring cooldown: ten minutes per game/device. Scoring remains available when other optional types are muted; when a selected kickoff/halftime/tactical alert is sent in the same check, omit the additional score push. Tactical cooldown: five minutes per game/device, shared with recent optional live notifications. Half/final outcomes are not discarded because a scoring update just occurred.
- All optional live types together: maximum six per device over a rolling fifteen minutes, with persistent timestamps. Finals, kickoff and ranking publications keep their established identities and are outside this optional-live budget. A rate-limited scoring intermediate may be omitted; later observed increases can provide a current combined score.

Server event claims and atomic IndexedDB worker claims both deduplicate. Provider TTL never exceeds candidate expiry; the worker also rejects expired payloads. Unsubscribe, category/type muting and expired/unfollowed games are checked again before delivery/display. Transport acceptance and browser display receipts remain separate. Diagnostic records include the new type selections, server activation times, state gate and rate-limit decisions, without endpoints or push keys.

## Validation status

Simulated regressions cover kickoff recovery/exclusions; default-off migration; independent scope settings; halftime and close/OT thresholds; AP edition freeze, missing/future/stale polls; confirmed finals; scoring increases/corrections; cooldown/budget behavior; overlap/deduplication; worker opt-out/expiry; and existing final/ranking/subscription flows. Browser checks verify controls/persistence without enabling push.

Real event evidence: App State–JMU final delivered October 22 at about 11:08 PM EDT and was found by the user. No real kickoff receipt is yet verified. No new halftime, close, Upset Watch, Confirmed Upset or scoring display receipt is verified. They remain off on existing subscriptions unless the user explicitly enables them. Production scheduler health and persistence checks validate the running code, not delivery of any unobserved alert type. Do not close issue #5 based on these tests.
