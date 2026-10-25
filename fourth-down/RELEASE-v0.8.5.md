# v0.8.5 — Desktop browser notifications

Desktop Web Push already existed through the shared `/alerts-sw.js`, VAPID sender, per-endpoint subscription records and explicit Save/Confirm permission gestures. This release reuses them. It adds a visible **Enable Desktop Notifications** control under More → Notifications, a desktop test button and permission/subscription guidance. Installation is not required on compatible desktop browsers.

Choose categories, favorites and follows in this browser, then enable. Preferences and capability tokens are local to each browser/profile; there is no account-wide preference synchronization. Disabling this browser deletes only its endpoint record and mutes its worker. Other devices retain their records and choices. Repeat visits reuse the saved controls; duplicate endpoint registration remains rejected. Lost browser storage requires renewal, rather than taking over an existing subscription.

Permission requests happen only after an explicit Save, Confirm or Enable gesture. No permission request or subscription is created during mount. Permission status refreshes after grant and on focus. Test success reports provider acceptance, not a visible OS notification. Inspect this device reports recorded worker/display acknowledgments; those acknowledgments do not prove a person saw a banner.

## Browser and background limits

Chrome, Edge, Firefox and compatible Safari use standard Web Push with supported provider endpoints. Safari requires a compatible macOS/Safari version (Safari 16.1+ on macOS Ventura or later). Capability checks govern availability. iPhone still requires the installed Home Screen app; desktop enable controls are not shown on iPhone/iPad.

Closing the site tab can permit background delivery; fully quitting the browser, OS sleep, private mode, enterprise policy, Focus/Do Not Disturb and OS/browser notification permissions can prevent or delay it. Firefox normally must remain running. These restrictions cannot be detected conclusively from site permission alone.

Primary references: [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Safari 16.1](https://webkit.org/blog/13399/webkit-features-in-safari-16-1/), [Firefox Web Push](https://support.mozilla.org/en-US/kb/push-notifications-firefox), [Chrome notifications](https://support.google.com/chrome/answer/3220216).

## Validation and evidence boundaries

188 automated tests cover shared notification behavior, per-endpoint browser isolation, duplicate endpoint rejection, provider endpoint families, closed-tab click destinations and existing-tab focus. Desktop UI checks run in Playwright Chromium, Firefox and WebKit with simulated PushManager, permission, API and worker responses. These establish no-install UI behavior, explicit opt-in, save failure/retry, reuse after revisit, truthful test wording, browser isolation and accessibility. They do not establish real provider/OS delivery. Branded Chrome, Edge and Safari are not equivalent to their automation engines; physical desktop delivery, native notification clicks and tab-closed OS delivery remain unconfirmed. Existing iPhone mobile regressions are simulated Chromium/WebKit checks, not a new physical-device delivery claim.

## Preserved behavior

No changes to production dispatch, source caching, poll cadence, plans, billing, event eligibility, deduplication, cooldowns or category mappings. v0.8.4 fresh current scoreboard/rankings and four-minute QStash checks remain unchanged. The existing hourly latency monitor stays active. Vanderbilt–Kentucky halftime was approximately 3m54s from end-of-quarter proxy to iPhone browser acknowledgment, 2.7 seconds after detection. It is not evidence that final latency is fixed or that an iOS banner was seen.
