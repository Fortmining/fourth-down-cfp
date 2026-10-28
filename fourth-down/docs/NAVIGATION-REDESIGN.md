# Navigation and Home redesign — review branch

UI-only reorganization from production a885792. Draft engine PR #19 stays untouched.

- `/`: three featured live/upcoming games, permanent-favorite shortcuts, official poll context, up to four explained resume movers, three relevant games and team search.
- `/games`: existing scoreboard, filters, game links and follow dialogs.
- `/rankings`: existing published AP/Coaches/CFP editions, comparison and poll movement.
- `/playoffs`: Road to the Twelve, published poll context, confirmed experimental resumes and games to watch. No bracket or probability.
- `/resumes`: existing confirmed Resume Center, unchanged calculations.
- `/following`: existing Watchlist and temporary follow management.
- `/settings`: existing notification preferences/history/installation plus saved appearance choices.
- `/more`: compact directory; `/about`: methodology and source limitations.

Mobile: Home / Games / Playoffs / Following / More. Rankings and Resumes also have header shortcuts on phones. Desktop has all seven destinations. Existing root hash and ranking-query notification links redirect to their new destinations. Normal anchor navigation preserves existing unsaved-notification guards.

## Protected Preview isolation

Only a deployment with both `VERCEL_ENV=preview` and `FOURTH_DOWN_DESIGN_PREVIEW=true` uses read-only rewrites for `/api/live`, `/api/resumes`, `/api/teams/:id` and `/api/games/:id` to the current public production endpoints. No alert, subscription, scheduler or mutation endpoint is proxied. No Preview Redis, push or scheduler credentials are provisioned. Existing production-only release settings are not modified; the Preview gets its own deployment-local flags to render the already-released Resume Center. Browser preferences remain local to the Preview origin.

No scoring/ingestion API, notification implementation, service worker, polling schedule, credentials, stored preferences, resume model or publisher is changed. Website refresh intervals remain 60 seconds while visible. No feature activation or production deployment is authorized by this PR.

## Verification

Run `npm test`, `npm run lint`, `npm run typecheck`, and a production build with the existing Resume Center release flags. `scripts/navigation-browser-check.mjs` accepts `TEST_FEED_FILE` and `TEST_RESUME_FILE` captured source snapshots for reproducible desktop Chromium / iPhone-sized WebKit UI tests. Controlled fixtures are UI simulations, not new real delivery or game-result evidence.

`scripts/navigation-hosted-check.mjs` uses existing short-lived Vercel authentication scoped to the Preview origin, checks deployment protection and read-only current data, and never enables or sends notifications. It does not prove physical-iPhone PWA delivery or new real final-to-movement processing; those backends are unchanged.
