# Protected PR26 Pulse review

For the current UX Preview URL and deployment/application commit, use PR #26. The original review deployment recorded below is historical.

The approved follow-up to9ff36c5 enables fixtures only when VERCEL_ENV=preview AND FOURTH_DOWN_NEWS_PILOT=protected-preview-v1. Those flags are deployment-scoped, not project/production environment edits. NODE_ENV=production by itself never enables fixtures; production Vercel deployments reject the same flags. The original local-development opt-in remains supported.

The isolated build also enables NEXT_PUBLIC_FOURTH_DOWN_NEWS_PILOT=true and NEXT_PUBLIC_FOURTH_DOWN_NEWS_REVIEW=true. Every relevant page discloses fictional Pulse scenarios and the dated October28 archived scoreboard. Home, team, game, resume and notification API routes are rewritten to a gated local review handler, with no production forwarding, fetch, Redis, credentials or push. Writes return403; private model endpoints are unavailable. External publisher images are omitted. Snapshot games/schedules are selected subsets and are labeled incomplete; stats are not included.

Source-card destinations remain the publisher-verified Tennessee Athletics YouTube channel, not fabricated videos. No live publisher connection is configured. Existing production credentials and public flags are not changed. The branch's automatic Git deployments remain disabled. PR26 remains draft, PR19 untouched.

Preview browser storage is separate from production. For You starts empty unless favorites/follows exist on that Preview origin. Use the Tennessee Team Page's Add Favorite for review, or /pulse?team=2633 to inspect team samples without changing any favorite. Pulse notification plans save on that Preview browser only; no subscription is created or changed.

Validation: focused gate tests cover approved Preview, unapproved Preview, local development and unconditional production rejection. Local optimized Preview-mode build verifies rewrites before the single hosted deployment. Hosted Chromium/desktop and WebKit/iPhone checks exercise real hosted fixture responses, without browser mocking of APIs, and block external network requests. Unauthenticated access must redirect to Vercel Authentication. Existing short-lived origin-scoped Vercel authentication is used for checks; no bypass credential is created or logged.

## Original hosted review results

Protected URL: https://fourth-down-iejqzsptp-fortmining.vercel.app
Deployment: dpl_5raovVFvAipt4JaETTY99DKEMzX4; build commit ed407e486374da855186b24e582bf73a1a97026d. One hosted deployment created.

All23 focused tests, lint, type checking and optimized Preview-mode build passed. Seven local API isolation checks passed. Hosted Chromium desktop and iPhone-sized WebKit passed Home, Pulse, Team Pages, More/Settings, filters, attribution/destination validation, separate saved preference drafts, navigation/Back, and loaded-state accessibility. Mobile widths320/390/430 passed. Unauthenticated requests redirect302 to Vercel Authentication. Both blocked notification-write probes returned403. The production deployment and protection settings remain unchanged. No publisher API, Redis ingestion or notification delivery was connected.

Predeployment query-based rewrites were corrected to explicit path parameters after local validation exposed missing query values. Hosted tests also needed to wait for Team Pulse data, rather than asserting immediately after its heading rendered. That test wait and documentation are a follow-up only; the hosted application code is unchanged and no redeployment is needed. Physical iPhone/VoiceOver, actual publisher content/playability and real delivery are not verified.

### UX review update
The same Preview-only gate and archived review APIs protect the media, Settings and mobile-navigation refinement. No project credentials or production settings are needed. Run `scripts/news-pulse-hosted-check.mjs` with an exact protected origin and an existing short-lived Vercel identity; it scopes authentication to that origin, blocks external requests, checks fixture links and disabled alert writes, and covers desktop Chromium and iPhone-sized WebKit. `TEST_LOCAL=true` is for a locally built Preview-mode server and skips only hosted authentication. Optional `TEST_MOCK=true` uses archived API captures for development; it must never be used as hosted evidence.

The UX revision passes339 automated regressions and29 focused Pulse/isolation tests, plus lint/type checking and an optimized build. Chromium and iPhone-sized WebKit checks cover the new Settings route, plans/custom budgets, timezone overrides, failed-save retry and unchanged existing preference storage. A targeted offline Chromium pass covers unavailable/malformed feeds, retry and unsaved-choice warnings. Mobile checks additionally cover the More sheet's natural navigation height, focus trap, Escape, Back and destination selection. Local testing caught and fixed a timezone hydration mismatch, inherited header height on the sheet, and a history-navigation race before hosting.

Hosted UX checks passed on Chromium desktop and iPhone-sized WebKit, including widths320/390/430. The persistence assertion now waits for browser-storage hydration instead of reading the initial server-rendered checkbox. A final Safari-style touch check also exposed missing return focus after closing More; explicitly focusing its trigger before opening fixes this without changing the shared dialog behavior. More destination Back/Forward is covered separately from closing the sheet with Back. Local-mode reports do not claim hosted API probes, and local mode rejects non-loopback URLs.

## Permitted-source/story development batch
The current authorized Preview may set the additional deployment-only flag FOURTH_DOWN_NEWS_LIVE=permitted-v1. This enables the permitted Army RSS reader plus explicitly dated DVIDS editorial metadata. Without it, fixture isolation remains unchanged. Production rejects both modes. Core score/alert rewrites still use local archived captures; no production credentials or APIs are needed.

Use scripts/news-pulse-integration-check.mjs for this live/captured mode; the earlier hosted-check script remains a fixture-mode check. The integration controller scopes existing short-lived authentication to the exact Preview, blocks browser requests to other origins, and does not post to social networks or send notifications. Native sharing/clipboard are simulated; publisher discovery and story/cache responses are real hosted responses. It has a260 same-origin browser-request ceiling and writes screenshots only on a failure. Source refresh, costs and coverage limitations are documented in NEWS-PULSE-PILOT.md.
