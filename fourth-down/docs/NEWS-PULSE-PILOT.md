# Fourth Down Pulse: limited development pilot

This isolated draft is based on production commit 23a85eb (PR25). PR19, score ingestion, score-based GameDay Pulse, alert APIs/service worker, subscriptions, credentials, schedules and resume calculations are unchanged. This is not a public release.

## Local review

Use the existing lockfile and Node dependencies. Run:

```sh
NEXT_PUBLIC_FOURTH_DOWN_NEWS_PILOT=true FOURTH_DOWN_NEWS_PILOT=fixtures npm run dev -- --hostname 127.0.0.1 --port 3023
```

Open `/pulse`, Home, or `/team/2633`. For You reads existing browser-local favorites and unexpired team/game follows without writing them. A Tennessee favorite shows the sample team cards. Around College Football shows the explicitly marked national scenarios. The fixture feed has a fixed October30 scenario time, never a fabricated current publisher timestamp. Existing saved favorite/follow data does not have to be changed to browse national samples.

The public UI flag is off by default. Home/Team/navigation integrations appear only with that local build flag. `/api/news-pulse` returns no content by default; fixture mode requires development, the explicit server flag, and absence of VERCEL. Production builds and Vercel cannot serve the fixture packet even if the fixture flag is supplied. The endpoint has no network adapter, credential, Redis call, scheduler, delivery queue or sender. This makes the permission boundary enforceable rather than assuming a working RSS endpoint permits public redistribution.

`vercel.json` disables automatic Git deployment for feature/pulse-feed-pilot. No Preview, merge, production change or infrastructure provision is authorized.

## What works offline

- Shared same-origin feed contract; compact Home and Team Page cards; /pulse with For You / Around College Football, team and type filters, bounded pagination, attributed links, source evidence and meaningful empty/error states.
- Exact team aliases and provider tags; ambiguous shared aliases are withheld. Game linkage requires a verified schedule ID, both participants and compatible date. A game-only follow is not a subscription to all news about its teams.
- Stable source/item identities, explicit verified event clustering, revision ordering, corrections retaining original publication time, withdrawal tombstones, conflicting equal-version updates withheld, old/undated content labeled. Similar headlines alone never prove the same story.
- Local notification-plan settings in a new key (`fourth-down-news-pulse-draft-v1`). No existing notification key or server record is written. Master delivery is permanently OFF in this pilot. Save success means browser read-back succeeded, not server persistence. Storage errors retain drafts. Unsaved changes use the existing Save/Discard/Continue Editing guard; another-tab changes block overwriting.
- Separate permanent-favorite and temporary-follow category choices. Breaking and highlights default ON; routine and recaps OFF; national news/publisher-selected plays ON. This is not consent or a browser permission request.
- Configurable draft limits of 1–2/hour, 1–6/day; validated named IANA timezone and quiet interval; DST-aware midnight-spanning policy tests. This policy is not wired to delivery and does not change the existing Quiet preset or score-alert timing.

## Source verification and permission status

Registry evidence is reviewed October30,2026; no publisher calls are made by this pilot.

| Source | Verified evidence | Remaining condition | Enabled ingestion |
|---|---|---|---|
| Tennessee Athletics on YouTube | https://utsports.com/sports/football links https://www.youtube.com/@TennesseeAthletics/featured; supported API terms at https://developers.google.com/youtube/terms/developer-policies | Approve API configuration, resolve/pin actual channel ID, validate resources, meet API attribution/privacy requirements | No |
| NCAA FBS RSS | https://www.ncaa.com/rss; one research fetch previously verified XML/20 items | Public ingestion/reuse permission under NCAA.com terms unresolved | No |
| Texas football RSS | https://texaslonghorns.com/rss_feeds; previous research XML/10 items/TTL60 | Public redistribution/push permission unresolved; do not poll faster than published TTL without clearance | No |
| ESPN / theScore | Investigation found restrictions and no verified supported permission-cleared news interface | Explicit permission or applicable supported license | Excluded |

Sample cards are synthetic test cases. They open the verified official channel, explicitly not an alleged story or video. No fake video IDs, article URLs, thumbnails, breaking labels or source publication claims appear in the UI. Actual source-item correctness and video playability cannot be validated without an approved connected source. Do not describe fixture tests as real news delivery.

No XML scraping/parser or undocumented publisher API has been added. No API key is requested, created or embedded. No YouTube webhook subscription is created. Future callbacks must be validated against pinned channel identities and supported API resource checks before adding live data.

## Resource model

**Current pilot:** zero publisher/API, Redis, QStash and push operations; one local feed GET per mounted Pulse surface and explicit retry, no interval or visibility polling. The local API generates seven fixtures only. The default unavailable packet is cacheable60seconds; fixture responses use no-store. A later live adapter would need a shared materialized packet and refresh budget; none is claimed to be operating now.

For later planning only:100 daily users ×5 opens ×2 responses =1,000 feed responses/day. At50KB this is~1.5GB/30days. Six hourly RSS feeds would be144 requests/day; eight hourly channel recovery reads192/day, plus48 validation calls/~240 ordinary YouTube units/day. Those are hypothetical permitted-provider assumptions, not measurements. Redis planning model:2,000 base commands/day +8 per60 items +12 per200 push attempts, plus10% contingency =161,040/month. With1,000 users and2,000 attempts/day the earlier model reaches943,800/month, exceeding the published free Redis allowance before current workloads. Additional infrastructure, quotas, headroom, CPU and costs must be measured/approved before any hosted release. This pilot adds no recurring job.

## Review and acceptance boundaries

Run focused news tests, all existing unit regressions, lint, typecheck and production build. The browser script uses local captured scoreboard/resume packets and simulated team data, blocks all external requests, mocks existing alert APIs and checks that existing preferences stay byte-for-byte unchanged. It covers mobile/desktop, accessible controls, source links, personalization, missing timestamps, stale cards, empty/filter states, rejected storage writes, persisted custom choices, offline/malformed feed recovery, unsaved navigation and source disclosure. Screenshots are local simulated UI evidence.

Remaining approvals: source permissions/API credentials and connection, any protected Preview, and any public release. Pulse push delivery requires a separate future implementation/review of server persistence, browser permission, service-worker category/link gates, targeting, quiet hours, durable claims, limits, receipts and actual-device evidence. Existing service-worker destinations must not be changed just for this feed-first pilot.

## Validation results

- 329/329 automated regressions pass, including19 new Pulse cases; the focused19 pass after final core changes. Lint, type checking and optimized production build pass. No dependencies or lockfile changes.
- Chromium desktop checks passed the complete pilot flow. iPhone-sized WebKit passed320/390/430 layouts, accessibility, existing preference preservation, saved custom choices, rejected saves, unsaved navigation and offline/malformed response recovery. A320px filter overflow and missing explicit select names were fixed. Local development-cache failures were addressed by rebuilding generated cache; they are not hosted-delivery evidence.
- Local production-mode negative test passes even with the fixture flag supplied: empty unavailable packet, pushDelivery=false, hidden Home integration and POST405. Default packet measured1,102bytes; no hosted CPU or billing claim.
- Source/API adapters, external news publication and video availability are unverified and disconnected. All browser scenarios are simulations, with external requests blocked. Physical iPhone PWA/VoiceOver and real source-to-device delivery have not been tested.
- The existing Home loading placeholder has a contrast issue before score data arrives; loaded Home/Pulse states pass the accessibility audit. This unchanged loading style is outside this draft's source/push scope.
