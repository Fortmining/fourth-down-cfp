# National Pulse pilot — October 31, 2026

## Implemented versus live

All 138 FBS identities and current conference memberships are generated from the existing mascot registry. One reusable matcher handles canonical names, verified publisher tags, conference context and ambiguous names, with FCS disambiguation. Existing favorites and temporary follows remain distinct. Conference relevance is not an assertion that every member appears in a story.

Automatic team coverage: **1/138 (Army)**, with **137 gaps**. Army's permission-cleared RSS is connected. DVIDS is a verified, curated Army–Navy spirit video, not automatic game highlights. KFF Health News RSS is connected as a strictly filtered national supporting source; a healthy feed with zero college-football matches is not team coverage. Real cross-conference story coverage has NOT been achieved. Multi-conference matching and videos are tested using explicit simulations, not fabricated published content.

The coverage panel and `/api/news-pulse/coverage` expose configured and healthy coverage separately, permission evidence, refresh requirements and limitations. Ownership references in the 138-team channel setup template are candidates, not verified video-channel ownership or redistribution permissions.

## Sources and permissions

- Army: canonical official RSS; permitted metadata, attribution and exact article links. Ten-minute shared refresh.
- KFF Health News: https://kffhealthnews.org/partners/ explicitly supports RSS embedding for automated publication. https://kffhealthnews.org/feed/ returned 200 during discovery. Use title, original URL, publisher time and author only, with attribution; no article body or third-party images. Hourly refresh. Healthcare/NFL/unrelated items are excluded.
- Happening @ Michigan: https://events.umich.edu/feeds permits website feeds, but documented discovery received a 403 challenge. Disabled; no bypass or repeated attempts. Not counted as live coverage.
- FOX: https://www.foxsports.com/rss-feeds limits free use to noncommercial individuals/nonprofits. Fourth Down's eligibility is unestablished; disabled.
- ESPN, CBS, Instagram: no approved accessible interface/reuse grant or configured credentials established. Disabled, no scraping or private endpoints.
- X: official https://docs.x.com/x-api/getting-started/pricing documents prepaid pay-per-use; Posts Read $0.005/resource, Users Read $0.010/resource. Official account timelines are supported with authorized tokens. 138 accounts × 10 new posts/day × 30 days = $207/month in post reads alone, before user/media or other charges. No credentials or credits purchased; developer-policy/display review required before connection.

## Video setup, not activated

Generic YouTube adapter validates pinned channel ownership, public/processed status and exact video IDs; authentic API thumbnails, timestamps, team/conference evidence and category labels are retained. Missing/private/deleted uploads are withheld. Interviews, previews and promotions are not called game highlights. No channels are configured live.

Required approval/setup: an approved Google project with YouTube Data API enabled; a server-only key restricted to that API in the protected Preview; verified official UC channel IDs and UU uploads playlist IDs; rights/policy review and a shared quota budget. No OAuth or user credential is needed for public metadata. Generate the all-team configuration template with `scripts/prepare-pulse-channels.mjs OUTPUT_PATH`; entries start unapproved and IDs are empty.

Official playlistItems.list and videos.list cost one quota unit each. 138 hourly channels × two calls × 24 hours = 6,624 units/day; twenty national channels add 960, before retries/pagination. Google's documented default other-endpoint allocation is 10,000/day, but actual project quota is unverified. No search.list discovery loop or per-visitor API reads.

## Sharing and privacy

Stable story paths, original publisher links, branded 1200×630 PNG, native share/copy and X/Facebook composers remain available. Canonical and og:url use the current production hostname; Preview images remain protected for authenticated QA. Public unfurling and public account-free landing pages require a later approved production release; do not remove Preview protection to test social crawlers. A future custom-domain migration needs permanent redirects preserving existing paths.

## Operating assumptions and limitations

No new Redis, scheduler, subscription mutation or push sender. Provider reads share cached normalized data; Army 10 minutes, KFF 60 minutes; aggregate display 10 minutes. Two concurrent adapters, eight-source batch ceiling, response-size/time limits, bounded records and cached failures. The single-worker request estimate is 144 Army + 24 KFF requests/day, about 6.5 MB/day at observed feed sizes/upper bounds; this is an estimate, NOT a measured global account cap. Regional cold starts/revalidation can amplify fills. Vercel CPU/billing and global cache amplification were not measured by this pilot. More sources must fit explicit batch/quota limits rather than silently creating unbounded fan-out.

History is limited to bounded cache/process state and committed verified captures; restart-durable corrections, long-lived shared URLs and coordinated ingestion retention require a release design before broad public rollout. Do not equate current pilot caching with a durable news archive.

## Release recommendation

Keep draft/private. Next useful step is approval and setup for restricted YouTube public-metadata access plus permission-cleared official feeds across conferences. Then verify actual multi-conference live samples, quota/cache behavior and durable story/correction retention. Pulse notification delivery and public activation require separate approval. Existing score alerts, subscriptions, production configuration and PR #19 remain unchanged.
