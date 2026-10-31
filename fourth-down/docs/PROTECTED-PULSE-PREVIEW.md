# Protected PR26 Pulse review

The approved follow-up to9ff36c5 enables fixtures only when VERCEL_ENV=preview AND FOURTH_DOWN_NEWS_PILOT=protected-preview-v1. Those flags are deployment-scoped, not project/production environment edits. NODE_ENV=production by itself never enables fixtures; production Vercel deployments reject the same flags. The original local-development opt-in remains supported.

The isolated build also enables NEXT_PUBLIC_FOURTH_DOWN_NEWS_PILOT=true and NEXT_PUBLIC_FOURTH_DOWN_NEWS_REVIEW=true. Every relevant page discloses fictional Pulse scenarios and the dated October28 archived scoreboard. Home, team, game, resume and notification API routes are rewritten to a gated local review handler, with no production forwarding, fetch, Redis, credentials or push. Writes return403; private model endpoints are unavailable. External publisher images are omitted. Snapshot games/schedules are selected subsets and are labeled incomplete; stats are not included.

Source-card destinations remain the publisher-verified Tennessee Athletics YouTube channel, not fabricated videos. No live publisher connection is configured. Existing production credentials and public flags are not changed. The branch's automatic Git deployments remain disabled. PR26 remains draft, PR19 untouched.

Preview browser storage is separate from production. For You starts empty unless favorites/follows exist on that Preview origin. Use the Tennessee Team Page's Add Favorite for review, or /pulse?team=2633 to inspect team samples without changing any favorite. Pulse notification plans save on that Preview browser only; no subscription is created or changed.

Validation: focused gate tests cover approved Preview, unapproved Preview, local development and unconditional production rejection. Local optimized Preview-mode build verifies rewrites before the single hosted deployment. Hosted Chromium/desktop and WebKit/iPhone checks exercise real hosted fixture responses, without browser mocking of APIs, and block external network requests. Unauthenticated access must redirect to Vercel Authentication. Existing short-lived origin-scoped Vercel authentication is used for checks; no bypass credential is created or logged.

## Hosted review results

Protected URL: https://fourth-down-iejqzsptp-fortmining.vercel.app
Deployment: dpl_5raovVFvAipt4JaETTY99DKEMzX4; build commit ed407e486374da855186b24e582bf73a1a97026d. One hosted deployment created.

All23 focused tests, lint, type checking and optimized Preview-mode build passed. Seven local API isolation checks passed. Hosted Chromium desktop and iPhone-sized WebKit passed Home, Pulse, Team Pages, More/Settings, filters, attribution/destination validation, separate saved preference drafts, navigation/Back, and loaded-state accessibility. Mobile widths320/390/430 passed. Unauthenticated requests redirect302 to Vercel Authentication. Both blocked notification-write probes returned403. The production deployment and protection settings remain unchanged. No publisher API, Redis ingestion or notification delivery was connected.

Predeployment query-based rewrites were corrected to explicit path parameters after local validation exposed missing query values. Hosted tests also needed to wait for Team Pulse data, rather than asserting immediately after its heading rendered. That test wait and documentation are a follow-up only; the hosted application code is unchanged and no redeployment is needed. Physical iPhone/VoiceOver, actual publisher content/playability and real delivery are not verified.
