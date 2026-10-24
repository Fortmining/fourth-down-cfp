# Fourth Down v0.8.2 — Watchlist navigation

The primary navigation is now Home / Games / Watchlist / Playoff / More. All five bottom destinations remain available on mobile through 1000px, including iPhone landscape, with existing bottom safe-area clearance and 50px minimum tab height. Game and team detail pages share the bottom navigation and have a Watchlist header link. Existing section hashes and game/team routes are retained. Initial deep-link scrolling is reapplied after the first live response expands the page; subsequent refreshes do not reset reading position.

Watchlist uses existing temporary follows, separately from permanent favorites. It lists live games first, upcoming games next, and confirmed recently completed games last. Available feed scores, status, kickoff time/TBD and valid period/clock values are displayed without estimating missing values. Each game links to its internal detail page. Follow-specific options open the existing accessible follow dialog directly in Watchlist. Each matching game/team follow has its own unfollow control; follows without an available feed game remain manageable here. The empty state links to Games.

Recent results are a separate local display cache (at most 20 visible games for 24 hours after first observed final, with up to 40 local entries/tombstones retained for 48 hours and a 36-hour scheduled-start freshness bound). Only finals passing the existing confirmed-final gate can enter it, and only for an active temporary follow at observation time. It survives reopening on the same device. It does not restore expired follows, create subscriptions, extend eligibility or update the worker snapshot. A final that was never seen locally while followed may not appear in this cache. Existing final-score delivery/cleanup is unchanged. No live-count badge is shown; there is no inferred count from incomplete/stale feeds. Permanent favorites are not mixed into this list.

No subscription API, push delivery logic, event identity, notification setting, Pulse rule, cooldown, cap, ranking rule or scheduler configuration changed. The push worker revision is updated to 0.8.2 only.

## Validation

- 170 unit/integration tests, including new Watchlist ordering/overlap/expiry/clock cases and existing push worker/server, follow persistence, favorite-team/ranking, kickoff recovery and Pulse regressions.
- Type checking, lint, production build.
- Dedicated Chromium and WebKit Watchlist flows: all five tabs, cross-page and initial deep-link scrolling, inline management, unfollow, persistence after reload, separate favorite settings, live/upcoming/final order, scores/clocks and recent-result persistence.
- Mobile sizes: 320, 390 and 430px portrait; 844px landscape; all tab targets at least 44px, no horizontal overflow. Axe checks for Watchlist and navigation.
- Existing follow-dialog, preset, Pulse/inbox and whole-app browser regressions.

Browser feed, subscription and worker tests are simulated. Production smoke and scheduler observations are read-only. Physical iPhone safe-area rendering, VoiceOver and a new real-event push delivery require device confirmation; browser tests are not evidence of those.
