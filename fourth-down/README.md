# Fourth Down

Public College Football Playoff tracker. The Next.js application lives in `fourth-down/` (the existing Vercel root directory).

## Current release

v0.8.4 bypasses the Next.js scoreboard and current-ranking cache for scheduled notification detection while preserving public visitor caching. It records source-fetch timing for latency investigation. Polling remains every four minutes. See [v0.8.4 release notes](RELEASE-v0.8.4.md).

v0.8.3 exposes independent Scoring updates and Close game options for permanent favorites and adds delivery-outcome diagnostics. Saved choices remain unchanged until explicitly saved. v0.8.2 Watchlist navigation and v0.8.1 presets are preserved. See [v0.8.3 release notes](RELEASE-v0.8.3.md).

## Run and verify

Requires Node.js 22.18+ (24 recommended).

```sh
cd fourth-down
npm ci
npm test
npm run build
npm run dev
```

## Data and editorial policy

`/api/live` reads ESPN's current FBS scoreboard and rankings, with a 6-second provider timeout per request and 60-second cache. Scores and rankings fail independently; a total outage returns 503. The client refreshes every minute while visible, times out after 15 seconds, retains its last successful snapshot on request failure, and flags stale snapshots after three minutes. This is not a guaranteed real-time service.

The published rankings view exposes AP Top 25, AFCA Coaches Poll and CFP committee rankings separately, with a selector and comparison table. Current-season CFP rankings take priority as the automatic default, followed by AP; Coaches never silently substitutes for AP. Explicit visitor selections persist during refreshes. The independent descriptive outlook has its own fixed input and is not changed by the ranking selector. Publication dates and fetch dates are distinct. The API requests the preceding ranking week as well as the latest feed because ESPN may return only polls published in the requested week. Each source retains its own latest available edition and flags older editions; prior-season polls are excluded. A missing edition after the expected release is marked unavailable, not asserted to be unpublished. The November 3, 2026 CFP first-release date follows https://collegefootballplayoff.com/news/2026/8/6/sc-aug-2627. Comparison uses the union of ranked teams, distinguishes NR from no edition, and computes spread only from actual ranks.

Movement compares the previous edition of the same poll; game ranks can reflect a different poll or game-time ranking. Names, records and conferences come from the provider.

The outlook is a descriptive poll-position model, not a probability model: 1–4 leading, 5–12 in the conversation, 13–18 bubble, 19–25 chasing. The bracket is explicitly an illustration of poll ranks 1–12. It does **not** predict conference champions or apply automatic bids. There are no odds, clinch claims or mathematical elimination claims. Unranked teams are not considered eliminated.

2026 qualification copy follows https://collegefootballplayoff.com/sports/2024/5/29/12-team-format (verified October 18, 2026). Review this copy when rules change. ESPN public endpoints are undocumented and can change; confirm data and logo licensing before commercial use.

## Deployment

Preserve the existing GitHub → Vercel integration and its `fourth-down` root directory. Push a verified commit to the configured production branch. Verify Vercel's commit status, the production homepage, and `/api/live`. Roll back through Vercel deployment history or revert the change commit if needed. No environment variables, external database, or Vercel project changes are required.


## v0.3 · Saturday Night Stadium

Midnight navy, off-white, athletic type, yard-line hero, and bold scoreboards.
The Colorway selector offers Stadium Gold (default), Turf Electric, and Prime Time;
choices persist on this device when browser storage is available. No external fonts,
textures, or image downloads are needed for the redesign. Team marks retain explicit
dimensions and lazy loading. Reduced-motion preferences are respected.

Mobile layouts keep controls touch-friendly, preserve poll rank order, and contain
wide comparison tables and brackets in keyboard-accessible scroll regions.
All v0.2 feed, source selection, comparison, outlook, bracket, and score filters remain.

Validate with `npm test` and `npm run build`. Run `npm start` to inspect the production build.

Preset/mobile regressions (with a running development or production server):

```sh
TEST_URL=http://127.0.0.1:3000 npm run test:presets
```
