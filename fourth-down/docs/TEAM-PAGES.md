# Team center verification

This feature starts from production `43a0cb4` (merged PR #20), on `feature/team-detail-pages`. Draft PR #19 and its branch are untouched. No merge or deployment is authorized. `vercel.json` disables automatic Git deployments for this feature branch only; main's deployment workflow is unchanged. See [Vercel's branch deployment configuration](https://vercel.com/docs/project-configuration/git-configuration).

## What changed

- `/team/<ESPN id>` has Overview, Schedule and Stats sections, current overall/conference records, published AP/Coaches/CFP positions and dates, supplied identity/logo/conference, and the existing Follow Team dialog.
- Team names/logos link directly from rankings, comparisons, poll-position outlook tiers, illustrative bracket, movers, Games and active/recent Watchlist cards. Optional poll context remains outside the team-page link, avoiding nested interactive controls.
- The schedule fetches both explicit 2026 regular/postseason periods. It shows verified W/L/final scores, live scores/clocks, opponents, neutral/home/away sites, announced networks, local announced kickoff times and explicit TBD dates. The next/live fixture is highlighted. Unannounced opponents/bowls/championship participants are not inferred.
- Past games outside the global scoreboard use a cached ESPN summary fallback in the existing game screen. Failed refreshes retain the previous snapshot and show errors.
- Follow Team reuses one-game/24-hour/seven-day durations and per-follow notification options. Opening a page never requests permission or saves preferences. Permanent favorites remain separate; their existing pending-save behavior is preserved.

## Sources and correctness

Public ESPN endpoints use the existing numeric identifiers:

- Site API `/teams/<id>` for profile; `/teams/<id>/schedule?season=2026&seasontype=2` and `seasontype=3` for supplied fixtures.
- Core API `/v2/sports/football/leagues/college-football/seasons/2026/types/2/teams/<id>/statistics` for category-qualified metrics and supplied ranks.
- Site API `/summary?event=<id>` for older game details.
- The existing public `loadLiveFeed` supplies canonical current records and immutable official poll editions; a poll's historical record is never substituted for a current record.

Wrong identifiers/seasons/periods and malformed schedule entries are rejected or labeled partial. An empty future postseason is legitimate. Confirmed results require ESPN Final status, completed=true, valid unequal scores and a non-future date. ESPN object-valued schedule scores are normalized. Stable game identities prevent duplicates; confirmed Finals survive a transient pre/live regression and corrected Finals can replace them.

Stats distinguish category-qualified offensive/defensive metrics, preserve zero and negative turnover margins, and show unavailable values explicitly. Points allowed/game is calculated from verified ESPN final scores only when full supplied coverage matches canonical games played; partial coverage cannot produce a purported season average. The calculation basis is displayed. Reported conference standing is withheld if its profile record disagrees with the canonical current record; it is never presented as a championship tiebreaker/qualification decision.

## Freshness and operations

Profile/schedule and summary sources revalidate after 60 seconds; stats after 300 seconds. Team/game API responses use s-maxage=60 / stale-while-revalidate=60. Independent source calls run concurrently with six-second limits. The team page refreshes every minute while visible, and on visibility/connectivity return. Failure preserves the last successful snapshot. Source/assembly timestamps do not establish first ESPN publication.

No Redis writer, QStash delivery, fixed job, dependency or paid service is added. Ordinary website requests still consume functions/cache/data transfer. Notification `loadLiveFeed({forAlerts:true})`, v0.8.4 no-store fetching, four-minute polling, push subscriptions, credentials, deduplication and cooldowns are unchanged. AP tied-rank issue #21 is not bundled.

Measured local production-build API payloads were approximately 19–20 KB. Six first-touch team calls took 0.60–2.07 seconds, except Tennessee's 7.88-second cold call including shared record-foundation warm-up. These are local observations, not Vercel production latency or billing measurements.

## Honest source limits

- October 26 source audit: Tennessee, Ohio State, Utah, Miami and Notre Dame each have 12 fixtures; Boise State has 11. All supplied fixtures are shown; an additional game is not invented.
- ESPN's `team.name` is a nickname, not evidence of the actual mascot's name. Nickname is displayed separately; mascot is Unavailable unless an explicit mascot field is supplied.
- ESPN core ranks include values beyond FBS membership counts and do not identify division scope. They are labeled ESPN ranks only. Verified FBS national/conference statistical ranks are unavailable, not calculated or implied.
- Yards allowed/game is missing in sampled feeds. Defensive sacks, tackles and interceptions are season totals. Games played and calculation/source basis are shown; stats can lag a Final.
- There was no real live-to-final game transition during this work. Transition/outage tests use simulations. iPhone-sized WebKit is emulation; no physical iPhone or new real push/banner delivery was verified.

## Validation

211 automated tests, lint, production build and type checking pass. The existing notification suite includes permanent favorites, temporary follows, ranking handling, explicit opt-in, subscription isolation, scheduling, cache freshness and deduplication regressions.

Real ESPN audit at approximately 13:10Z October 26 covers Tennessee, Ohio State, Utah, Miami, Boise State and Notre Dame. Every supplied regular-season game state and score matches the raw schedule; confirmed W/L totals match current records. Eight supplied offensive/defensive/turnover metrics per team match raw core stats. Tennessee is 6–2 overall / 3–2 conference, 12 fixtures, 8 verified Finals. Historical Furman summary resolves outside the global scoreboard. Real-data pages passed Chromium desktop and iPhone-sized WebKit for Tennessee, Ohio State and Boise State.

Final compiled-server checks passed: Chromium, Firefox and WebKit desktop plus iPhone-sized WebKit team flows; the tracker passed all six theme accessibility combinations, independent rankings, navigation, mobile layout and outage recovery. Watchlist, favorites, presets and desktop-notification browser regressions passed with simulated server/worker/provider inputs. Tests cover full fixture schedules, live→final changes, old-game links, all navigation entry links, back, follow persistence/favorite isolation, failed refreshes, missing stats, six theme combinations, mobile sizing and accessibility. The existing current-record browser fixture targets the new team API. The tracker test checks whether the source actually supplied Finals instead of requiring invented results after a week rollover; `TEST_FEED_FILE` allows repeatable captured public-feed replay.

Commands from `fourth-down/`:

```sh
npm test
npm run lint
npm run build
npm run typecheck
npm start -- --port 3011
TEST_URL=http://127.0.0.1:3011 npm run test:teams
TEST_URL=http://127.0.0.1:3011 npm run test:watchlist
TEST_URL=http://127.0.0.1:3011 npm run test:favorites
TEST_URL=http://127.0.0.1:3011 npm run test:presets
TEST_URL=http://127.0.0.1:3011 npm run test:desktop
TEST_URL=http://127.0.0.1:3011 node scripts/current-records-browser-check.mjs
```

`TEAM_ENGINE=webkit TEAM_MOBILE=1` selects the mobile team test. Workspace evidence and screenshots are retained in `outputs/team-pages/` outside Git. Credential files are not included.
