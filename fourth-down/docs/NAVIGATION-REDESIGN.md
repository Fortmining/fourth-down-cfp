# Navigation and Home redesign — review branch

UI-only reorganization from production a885792. Draft engine PR #19 stays untouched.

- `/`: three featured live/upcoming games, permanent-favorite shortcuts, official poll context, up to four explained resume movers, three relevant games and team search.
- `/games`: AP Top 25 by default; Following, Conference and All FBS filters, calendar week/date selection, grouped statuses and 12-game progressive loading. Existing source window, game links and follow dialogs remain.
- `/rankings`: existing published AP/Coaches/CFP editions, comparison and poll movement.
- `/playoffs`: Road to the Twelve, published poll context, confirmed experimental resumes and games to watch. No bracket or probability.
- `/resumes`: existing confirmed Resume Center, unchanged calculations.
- `/following`: permanent-favorite cards alongside the separate temporary Watchlist; existing follow/unfollow behavior. Retry is visible only for a pending, recorded retryable delivery-save failure.
- `/settings`: existing notification preferences/history/installation plus saved appearance choices.
- `/more`: compact directory; `/about`: methodology and source limitations.

Mobile: Home / Games / Playoffs / Following / More. Rankings and Resumes also have header shortcuts on phones. Desktop has all seven destinations. Existing root hash and ranking-query notification links redirect to their new destinations. Client-side links preserve existing unsaved-notification guards; explicit Browser Back tests verify Continue Editing and Discard in Chromium and WebKit.

## Protected Preview isolation

Only a deployment with both `VERCEL_ENV=preview` and `FOURTH_DOWN_DESIGN_PREVIEW=true` uses read-only rewrites for `/api/live`, `/api/resumes`, `/api/teams/:id` and `/api/games/:id` to the current public production endpoints. No alert, subscription, scheduler or mutation endpoint is proxied. No Preview Redis, push or scheduler credentials are provisioned. Existing production-only release settings are not modified; the Preview gets its own deployment-local flags to render the already-released Resume Center. Browser preferences remain local to the Preview origin.

No scoring/ingestion API, notification implementation, service worker, polling schedule, credentials, stored preferences, resume model or publisher is changed. Website refresh intervals remain 60 seconds while visible. No feature activation or production deployment is authorized by this PR.

## Verification

Run `npm test`, `npm run lint`, `npm run typecheck`, and a production build with the existing Resume Center release flags. `scripts/navigation-browser-check.mjs` accepts `TEST_FEED_FILE` and `TEST_RESUME_FILE` captured source snapshots for reproducible desktop Chromium / iPhone-sized WebKit UI tests. Controlled fixtures are UI simulations, not new real delivery or game-result evidence.

`scripts/navigation-hosted-check.mjs` uses existing short-lived Vercel authentication scoped to the Preview origin, checks deployment protection and read-only current data, and never enables or sends notifications. It does not prove physical-iPhone PWA delivery or new real final-to-movement processing; those backends are unchanged.

## Review evidence (October 28, 2026)

Application commit: `db7dda5`. Protected Preview: https://fourth-down-j4uksft8p-fortmining.vercel.app (existing Vercel Authentication; deployment `dpl_9z1BH1PkiRxfN9vxaYvUc7waL3bH`). PR #25 is separate from PR #19. Follow-up test/documentation commits do not change the deployed application.

- Full automated suite: 303 passed, zero failures. Production build, type checks and lint passed.
- Captured-source Chromium desktop and iPhone-sized WebKit: dedicated routes, five mobile tabs, old notification links, official poll query selection, offline recovery, unchanged favorite preferences, temporary-follow persistence, saved appearance, unsaved-change guards, mobile widths 320/390/430/844 and automated WCAG checks passed.
- Protected hosted checks use current public data rather than simulated events. Unauthenticated access remains redirected to login. Team schedules, team/game navigation and the existing Resume Center remain available.
- WebKit can emit native access-control diagnostics for canceled navigation or Vercel-toolbar requests. The harness excludes a diagnostic only when its exact resource matches a recorded canceled/aborted request; all other script errors still fail. The final local mobile run had no such diagnostics; the hosted run recorded one matching cancellation. This does not establish a general browser permission failure.
- The confirmed resume packet still has its first baseline; the meaningful no-movement state is expected. No fabricated movers, test pushes, or source results were added.

Physical iPhone PWA / VoiceOver review remains manual. No real notification-delivery assertion is made by these UI checks. No production deployment or merge has occurred.

## Final UI refinement

The Playoff Race, Team Resumes and Movers & Losers share client-side navigation; `/resumes` remains shareable and has Back to Playoffs. Search and Show More state survive return navigation in session storage. Cards show supplied ESPN artwork, a source-logo color accent, confirmed records, a comparable strongest win, watch point and next test, with dated poll/evidence details expandable. No resume inputs or calculations change. Missing win-comparison evidence is labeled rather than ranked.

The existing cached `/api/live` and `/api/resumes` feeds are joined for display metadata, at the existing visible-page minute cadence. There are no per-team profile lookups or speculative link-prefetch bursts. Conference metadata is not guessed, and available calendar weeks are not represented as a complete season feed; full-season schedules remain on Team Pages. Installation guides are collapsed by device, and redundant Settings shortcuts are removed.

Final local validation: 310 regression tests passed; production build, lint and type checking passed. Focused Chromium and iPhone-sized WebKit checks cover all four Games filters, live/upcoming/final grouping, date/week selection, pagination, local restoration, favorites/follows separation, resume search and 12/24-card loading, source artwork, client-navigation document identity, normal Back, unsaved-setting safeguards, genuine retry visibility, responsive widths and automated accessibility. Controlled schedules and retry failures in these tests are simulations, not newly observed game or delivery events.

Updated hosted Preview screenshots/results are kept in the task outputs. Production, PR19, service workers, notification processing, source ingestion, Redis and schedules are unchanged. Preview hosting/development overlays are inspected, not disabled through production settings.
