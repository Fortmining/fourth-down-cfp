# Fourth Down v0.5

More / Settings contains persistent favorite teams, independent My Teams and Breaking CFP News categories, individual alert types, permission/subscription status, explicit enable/save/test/unsubscribe controls, and installation guides. Home, Games, Playoff and More share one responsive navigation surface. Community Chat remains reserved, without messaging or accounts.

## Delivery infrastructure

Use the existing `fourth-down-cfp` Vercel project. Production uses the free `fourth-down-push` Upstash Redis resource connected through Vercel Marketplace. The code accepts its `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables, or the equivalent `UPSTASH_REDIS_REST_*` names. VAPID keys, VAPID_SUBJECT and CRON_SECRET are sensitive production variables. Never commit their values or rotate signing keys while subscriptions are active.

The team is on Vercel Hobby. Its daily cron cannot support game alerts. The free `fourth-down-alert-checks` QStash resource should issue an authenticated GET to `/api/alerts/dispatch` every four minutes (360 checks/day, below the Marketplace plan's displayed 500/day allowance), with no retries. It forwards `Authorization: Bearer <CRON_SECRET>`. The app remains hosted entirely on the existing Vercel project. No desktop process or open website is required for scheduled checks.

Readiness requires a successful dispatcher heartbeat within six minutes. The first check creates a baseline without historical alerts. An interruption longer than five minutes suppresses potentially stale transitions; after recovery, the following check resumes normal comparisons. Delivery is best effort and can be delayed by the feed, scheduler, OS, network, or browser. It is not an emergency or instant-score service.

## Verification and privacy

All categories and types default off. Permission is requested only after Enable Notifications. Server records hold push endpoints, encryption keys, selected team IDs/names, alert choices and timestamps, protected by an unguessable device capability. There is no public subscription listing. Deleting a subscription removes its endpoint and preferences; deduplication keys contain hashed device IDs and event IDs. Local unsubscribe also mutes queued pushes in the service worker.

Provider acceptance is not delivery proof. Send test notification creates an explicitly labeled test and a five-minute, single-use receipt nonce. The service worker submits that nonce only after `showNotification()` succeeds. `/api/alerts/config` reports the last such receipt separately from scheduler readiness. A receipt proves browser processing, not that a person saw the OS notification. Verify on an opted-in real device, including the installed iPhone web app, before describing push as operational.

Kickoff alerts require an observed confirmed live status. Final scores require completed final status and numeric scores. Major upsets require confirmed finals and conservative top-ten/rank-gap rules. Poll alerts require a valid, newly published edition from that exact source; unavailable AP/Coaches/CFP polls never substitute for one another. Playoff developments require an editor-reviewed, dated, confirmed primary-source entry in `app/data/confirmed-developments.json`; it is intentionally empty until such reports are added. Projections never generate official developments.

Stable server and browser event IDs coalesce duplicate and overlapping category deliveries. Ambiguous provider failures retain their claim to avoid duplicates, so an alert may be lost instead of retried. Expired endpoints are removed. The small-audience dispatcher is bounded to 1,000 records; a delivery queue and capacity review are needed before scaling. Free-plan quotas and failures must be monitored.

The service worker does not intercept or cache pages, scores or rankings. Existing light/dark/colorway behavior, rankings, outlook, bracket, next-week games and the inline yellow Apple icon remain intact.


## Background verification follow-up

The user confirmed the immediate test appeared on an iPhone with the correct Fourth Down icon, permission Allowed, and an active subscription. Production recorded its service-worker receipt at **2026-10-22 10:34:47 AM EDT**. The app was open, so this establishes foreground delivery only.

`Send background test` explicitly queues one test per opted-in device. It becomes eligible after 60 seconds and expires after ten minutes. The protected scheduled dispatcher checks the queue before processing the real feed, reloads current opt-in settings, and sends a clearly labeled test through the same Web Push transport. Unsubscribe/all-off cancels eligibility. Atomic queue removal, server claims, and durable worker claims prevent repeated sends/displays; an ambiguous failure is not retried. A failed test does not interrupt real event processing. The receipt endpoint separately records `backgroundVerifiedAt`; this proves scheduled transport, while the tester must confirm the app was backgrounded or closed.

Production readiness remains conditional on that background test and a real upcoming game/poll observation. Isolated regression fixtures exercise favorites, independent AP/Coaches/CFP routing, reviewed developments, expired endpoints, provider failures, queued unsubscribe, overlapping categories, repeat checks, worker restarts, and receipt replay rejection. These fixtures never become production news or scores. Editorial playoff-development entries remain empty until an actual reviewed report is supplied.
