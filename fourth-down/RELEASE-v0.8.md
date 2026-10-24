# Fourth Down v0.8 — GameDay Pulse

## Delivered

National GameDay Pulse is separate from permanent favorites, temporary follows and existing breaking-news settings. All national categories default off on existing subscriptions. Quiet, Balanced and All In presets only edit a draft; Save Changes confirms the opt-in with the server. Individual categories and AP/Coaches/CFP sources can override the preset. Existing v0.7.1 follow dialogs, team durations, sticky saving, retry handling and unsaved-change protection remain available.

- **Interesting Live Game:** both teams in the frozen AP top 25, at least one in the top 15, Q1–Q3. Q2/Q3 margin must be at most 16. A verified clock/score progression witness is required; an unchanged live label is insufficient.
- **Close Game Discovery:** at least one AP-ranked team, margin at most eight in the last five minutes of Q4, or overtime. Regulation invitations stop below 90 seconds remaining.
- **Upset Watch:** reuse the existing late-game detector: an AP top-10 team tied, trailing, or leading by at most eight against an unranked team or one at least ten places lower.
- **Confirmed Major Upset:** reuse the AP-frozen, verified final/winner detector. This is final-result information, not an invitation to a finished game. Invalid/future schedules and results from games scheduled over eight hours ago are excluded from national alerts.
- **Official Rankings:** independent AP, Coaches and CFP publication choices. A durable last-valid-edition witness survives temporary missing source data. A genuinely new edition can recover a poll gap of at most one hour, with a conservative pre-gap opt-in cutoff. Source recovery and same-edition corrections do not manufacture publications. New, current editions replay for at most five minutes under the same event identity.

Discovery uses the existing scheduled feed, game memory, delivery pipeline, capabilities and push transport. Frozen AP ranks retain their edition labels. No scores, clock values or probabilities are fabricated. Fresh fetches and current complete AP data are required. Regulation periods must be plausibly later than the supplied start time; canceled, terminal/resurrected, premature and invalid game states are suppressed. Stale ESPN data can still delay or prevent an alert; a fresh fetch is not proof of ESPN’s own update latency.

Already followed or favorited games are not invited, even when their personal alert master is paused. Invitations open the internal game page and a fresh Follow Game dialog; only Confirm & Follow changes the watchlist. Explicit invitation expiry is carried in the link. Old links show current game status and an expiry notice. Rankings links select their actual source. Playoff-change links identify or gracefully reject the requested snapshot; no forecast alerts are generated in this release.

## Limits and deduplication

- Quiet: three national alerts per rolling 24 hours; Balanced: six; All In: twelve.
- At least ten minutes between national alerts; a confirmed major final may follow after two minutes.
- Category cooldowns: 15 minutes for Upset Watch/major finals, 30 minutes for other national categories.
- One live invitation to a game per six hours. A final upset is not treated as another invitation.
- Invitations expire within two minutes, earlier near the end of regulation, reserving at least 60 supplied clock seconds. No overtime duration is predicted.
- Fresh late-game situations can recover missed delivery windows under the existing regulation/overtime identity. Stable server claims and persistent worker claims prevent repeats.
- Overlapping legacy and national events merge by identity. Personal favorites/follows and existing rankings are not muted by new national budgets. Existing kickoff recovery (15 minutes), halftime/scoring/final eligibility, AP rules, cooldowns and live budgets remain intact.

## Private notification history

More → History shows the device’s most recent 100 generated alerts, up to 30 days, with category, generation time and destination. Same-origin capability checks protect every list, dismiss and clear request. No global audience/history endpoint exists. Controls are sent in JSON, never links. Changing/removing device controls clears displayed rows and prevents older asynchronous responses from restoring another subscription’s history.

Dismiss and Clear act only after server confirmation; failures retain the displayed history and allow retry. Neither resets delivery claims or budgets. Entries describe generated notifications, not proven OS banners; ambiguous provider failure may leave an unverified entry. History starts in v0.8; older private delivery diagnostics remain separate. History requires the saved, still-valid device subscription controls and a network connection. It is not an offline inbox or an account-synced cross-device archive.

## Playoff-model limitation and foundation

The existing model (`app/lib/model.ts`) groups published poll positions and illustrates a bracket. It does not forecast a selected 12-team CFP field, automatic qualifiers, conference champions or selection probabilities. **Playoff Shakeup and Bubble Movement are visibly disabled and normalized off on the server.** Presets cannot enable them.

The scheduled process now collects complete, fresh AP outlook snapshots with schema, model version (`poll-position-v1`), season, source edition, source IDs, actual shared `tierFor` output and timestamps. Matching inputs must be observed in two separate checks. Comparisons are source/season/version aware, same-edition corrections are held, incomplete data never replaces the last good output, and the public status hides stale snapshots. Ten editions are retained. Actual poll-tier movement explains the published rank change and explicitly disclaims CFP selection implications. This is an AP-specific foundation, not a substitute prediction model.

Before enabling playoff-impact notifications, implement and validate a real selection model, input/completeness contract, explainable selection changes, and version migration/replay policy. Do not present poll-top-12 movement as projected CFP-field movement.

## Validation and real delivery

158 automated regressions pass in the release validation, including all v0.7.1 regressions plus national eligibility, frozen rankings, missed polls, source gaps, model validation, presets, persistence, private history capabilities, clearing/dismissal, worker deduplication, overlapping events, budgets and offline/rejected saves. Mobile Chromium/WebKit checks cover presets and overrides, fresh/stale deep links, explicit follow confirmation, sticky saving, history failure/retry, keyboard behavior, automated accessibility and 320/390px layout. Browser API/worker controls and push transports in these tests are simulated.

Production verification is read-only: public UI/worker/version, unchanged existing subscriptions and category activation, and normal scheduled checks after rollout. No production test pushes or injected sports events are used. New national delivery and physical iPhone Home Screen/VoiceOver behavior remain unverified until actual evidence exists. Previously verified kickoff/final and any legacy delivery receipts are separate evidence, not proof of national Pulse delivery.

## Existing infrastructure and costs

No new project, database, scheduler, App Store app, native iOS work, paid integration or environment secret is required. Existing Vercel, Redis, VAPID and four-minute scheduling are reused. Redis traffic/storage increases: steady snapshot/ranking bookkeeping adds roughly six commands per successful check (about 2,160 per day at four-minute cadence), plus bounded inbox, budget and delivery audit operations. Existing plan usage/billing applies; no dollar estimate is implied. Snapshot history is capped at ten editions, inboxes at 100 entries/device with 30-day retention, and budgets expire. The existing 1,000-device bounded scan remains; a larger audience needs a dedicated delivery queue.
