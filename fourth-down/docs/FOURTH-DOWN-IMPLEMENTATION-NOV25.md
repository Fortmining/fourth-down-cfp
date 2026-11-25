# Fourth Down implementation — November 25, 2026

## Delivered

- National Home: horizontal scoreboard remains; compact hero; one featured game rail (ranked national matchups, then upcoming fallback); latest Pulse; four-team published-poll snapshot; subtle Following link. Removed the embedded full schedule, duplicate Games That Matter list, destination cards, and visible resume-mover panel from Home. Desktop and mobile say Home. Games retains full schedule/filter controls.
- Existing dark/light and blue/colorway preferences preserved. Connected bracket, readable compact cards, team marks, status colors, and article overlay use the shared theme variables.
- Playoffs opens with a connected, two-sided 12-slot bracket, four byes and all eleven matchups. Portrait fit view, expanded view, matchup names/records dialog, separate Projected/Official/What If modes, reset and automatic dependent-pick cleanup. Existing deeper What If champion and game assumptions also use this renderer.
- Projection reuses the existing qualification allocator; every assumption remains labeled. Unresolved automatic qualifiers have unknown seeds and conditional placement. Weekly published rankings are listed separately as Top 12, with a full Top 25 link. No invented official seed, qualifier or result.
- Official advancement accepts only a dated, reviewed CFP field manifest, explicit reconciled provider event IDs, correct participants, completed final status, past kickoff, numeric unequal scores and matching winner flags. Previous-round final results must resolve first. Older mapped games use the existing game API so they can survive the national-scoreboard window.
- Pulse headlines open a publisher iframe in a dialog while the feed and its filters/scroll remain mounted. Back/Escape/Close restore context. Open Original remains available. Timeout, explicit blocked-preview fallback and iframe error handling never scrape/proxy/reproduce the article body. Cross-origin frame blocking cannot reliably be detected by JavaScript; the fallback control always remains visible.
- Recruiting/Portal retain all 138 FBS programs, sourced ranks/stars/positions/status, reported/confirmed distinctions, and initials for players. Personnel hero and directory use ESPN program logos, including Alabama's correct team ID, with graceful fallback. No permitted photo feed was established, so no player photos are fabricated or acquired.
- Private provider-swappable TheRundown adapter: NCAAF sport 1, pregame full-game main moneyline/spread/total, books 19/23/22, source timestamps and five-minute minimum delay. Filters live/started games, closed/off-board/non-main/future-dated prices and unsupported books. Server-only API key; authenticated one-hour HttpOnly session. Both API and page return 404 in production regardless of the enable flag. A development-only link from Game Center opens the lab; no name-based cross-provider game join is attempted.
- Private cache uses the existing Redis service, a separate namespace and 15-minute expiry. One provider attempt per UTC day and ten per UTC month across all dates/instances, reserving the full free daily allowance before any upstream work. X-Datapoints actual usage tracked separately; missing header halts refresh; failed/uncertain attempts remain reserved. Manual fetch only; no schedules, purchases, paid plan changes or overages enabled.

## External data and setup still required

1. The CFP's official field is scheduled for December 6. `app/data/official-playoff-2026.json` deliberately remains empty. After publication, review source URL/publication/verification times, the twelve seeds and exact provider game IDs. Weekly poll positions must never be copied as official seeds. Today only conditional projections and isolated simulations can populate the bracket.
2. Existing moneyline paths were traced: ESPN `/api/game-extras` and the separately budgeted The Odds API live cache. They are unchanged. This work did not establish additional public-display rights, so no new public odds display was activated.
3. TheRundown Free is internal/personal use, not end-user display. Live credential testing awaits secure Preview environment setup. Do not paste any secret in a chat, issue, PR, or repository.
4. Player photos await a permitted source; initials are the intended fallback. Physical iPhone PWA behavior and publisher-specific login/cookie flows require real-device testing; responsive WebKit checks are separate evidence.

## Secure private odds configuration

Vercel → `fourth-down-cfp` → Settings → Environment Variables → **Preview only**, Git branch `feat/national-home-playoff-release`:

- `THERUNDOWN_API_KEY`: paste the Free key directly into Vercel's secret field.
- `FOURTH_DOWN_PRIVATE_ODDS`: `true`.
- `ODDS_DEV_ACCESS_TOKEN`: a new password-manager-generated random token, at least 32 characters. This authenticates the private lab; it is not the provider API key.
- `ODDS_PILOT_REDIS_URL` / `ODDS_PILOT_REDIS_TOKEN`: credentials for the existing private pilot Redis service. Keep its existing plan. Its old sensitive token is bound to another Preview branch and is not readable through the connector; enter it directly from the existing Redis dashboard. Do not broaden Production credentials or remove another branch's binding.

Redeploy that Preview branch after saving. Open its `/dev/odds` page and enter only the developer access token. Fetch one UTC game date with known upcoming NCAAF fixtures. Record book/market availability, price timestamps, X-Datapoints and remaining quota. Repeat within 15 minutes to verify a cache hit without another upstream request. No live API test is claimed before this succeeds. Do not add any `NEXT_PUBLIC_` key or add these variables to Production. Local alternative: place the same values in gitignored `.env.local`, run `npm run dev`, and use `/dev/odds` on localhost.

Provider references: https://docs.therundown.io/licensing-and-attribution · https://therundown.io/college-football-odds-api · https://docs.therundown.io/reference/data-model · https://docs.therundown.io/api-reference/generated/v2-events/get-events-with-markets-for-a-sport-and-date
