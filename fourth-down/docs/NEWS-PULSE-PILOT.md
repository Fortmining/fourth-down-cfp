# Fourth Down Pulse — private development pilot

PR #26 only. No production deployment, merge, Pulse push or PR #19 changes.

## Working scope

- Shared feed on Home, /pulse and Team Pages; personalized permanent-favorite and temporary-follow matching stays separate. Feed filters are bookmarkable and survive story Back navigation.
- Verified publisher metadata, original article/video destinations, source credits, publication versus observation dates, corrections/conflict withholding, stable identities, archive/empty/error states and branded media fallbacks.
- /pulse/story/[source]/[id] provides an attributed discovery page, original-source link and evidence. It does not copy full article bodies or host videos.
- Native sharing, clipboard, X/Facebook composer links and a downloadable 1200×630 Fourth Down card. Composers require user action; nothing posts automatically. Cards use typography, not publisher photographs or fabricated play imagery. Protected Preview links/social crawlers require Vercel access; public social unfurls and physical-device sharing are unverified.
- Existing browser-local Pulse plans, IANA quiet hours and independent team/national budgets are preserved. Delivery stays OFF. The prepared eligibility planner requires source verification, explicit classification, known publication time, audience/activation evidence, quiet-hour clearance, budgets and a stable unclaimed story identity. It neither writes claims nor contacts subscriptions or a sender. Routine RSS news is not labeled breaking.

## Connected and blocked sources

**U.S. Army official RSS:** https://www.army.mil/rss/static/0.xml . The documented /1.xml alias returns301 to this canonical publisher feed; the adapter pins /0.xml directly and continues rejecting redirects. The Army documents RSS use by external aggregators at https://www.army.mil/core/support/creating-content/rc/rss_feeds.html and permits redistribution unless otherwise specified, requesting credits, at https://www.army.mil/privacy/ . Only football metadata identifying Army West Point / Black Knights is selected. Unrelated military, high-school, NFL and soccer content is withheld. Metadata indicating copyright restrictions is withheld. No article-page crawler or publisher images are used.

A real October30 Army–Memphis item was observed in the feed; its publication timestamp and exact /article/296478/ destination are preserved in a dated fallback capture and test fixture. This is not an invented scenario. Feed omissions do not prove retractions; explicit conflicting updates are withheld.

**DVIDS editorial selection:** https://www.dvidshub.net/video/1026781/cbs-army-2nd-lt-michael-graham-and-2nd-lt-brandon-spence . The item identifies itself as public domain, credits Staff Sgt. Emilie Lenglain / U.S. Army Reserve, and provides an original embed destination. The source page lists publication date October19,2026; its timezone is unavailable, so no precise publication instant is invented. This is an Army–Navy spirit message, NOT game highlights. It appears under older publisher videos, not as a fresh play. It is an individually verified selection, not an automatic DVIDS feed. Applicable limitations/non-endorsement: https://www.dvidshub.net/about/copyright . No military visual information or insignia is copied into Fourth Down sharing artwork.

**YouTube:** supported uploads-playlist API adapter prepared with pinned channel/playlist validation, bounded responses, no search crawling and no key in URLs. It is not connected. No credentials have been acquired or provisioned. Supported API configuration/approval and actual channel IDs are still needed. NCAA, Texas, ESPN and theScore remain disconnected where permission/configuration is unresolved. No restricted feeds or pages are scraped. Broad current highlights coverage is NOT delivered by this pilot.

## Safety and operations

Live discovery requires ALL: VERCEL_ENV=preview, FOURTH_DOWN_NEWS_PILOT=protected-preview-v1, FOURTH_DOWN_NEWS_LIVE=permitted-v1. Production rejects these modes. Without the live flag, the approved fixture-only Preview continues working; production still cannot serve samples.

Existing score/team/resume/alert APIs stay intercepted by archived read-only review handlers. Army, Navy and Memphis Team Pages use the existing October28 record capture, explicitly partial schedules, no new statistics and no guessed results. Alert writes return403; private model endpoints404. Source discovery does not use Redis, QStash, score ingestion, subscription records or service-worker delivery.

Army RSS uses shared Next data caching with a 10-minute revalidation interval, per-worker single-flight/backoff, a five-second timeout, 128KiB response limit,100 entries,24 XML levels and no DTD/external entities. URLs are fixed server-side; redirects are rejected. There are no immediate retries.403 disables that worker's source reader;429/Retry-After imposes backoff. Cross-worker cold-start amplification/backoff is not globally coordinated: a public rollout needs operational measurement and, if necessary, a bounded single updater. This private Preview is not proof of a global hard publisher-request ceiling.

No new recurring job, paid service, key or Redis operation is added. With continuous visitors, one warm shared-cache refresh per10minutes is nominally144 RSS reads/day; inactive periods create no scheduled work. At the observed ~17.5KB feed size this is about2.5MB/day upstream, excluding cold-fill amplification. Visitor scenario:100 people ×5 feed opens/day ×8KB packets ≈4MB/day of feed data, excluding assets/story/share images. Actual packet/image sizes are recorded by the consolidated smoke test. Share PNG generation adds function CPU; billed CPU, global cache amplification and growing-traffic headroom remain unmeasured. Do not represent these estimates as verified billing or approve a public release from them.

Retention is capped at180days /1,000 records; the normal feed shows seven days, with an explicit older-content toggle. The curated fallback is a fixed capture, not durable editorial history or a live source. Shared cache is rebuildable; source failures expose capture/observation status instead of inventing fresh news.

## Validation

Use focused tests: news-ingestion, news-pulse, news-pulse-ux and news-review. They cover source permission gates, RSS/Atom parsing, date/URL/size safety, failed adapters, duplicates/revisions, archived video labels, prepared alert eligibility and disabled YouTube configuration. The final protected integration script covers the real feed/capture packet, cached consistency, story/deep links, branded PNG, simulated sharing/clipboard, archive Back navigation, Team Page integration, mobile More and existing score-alert isolation. Previously verified unchanged settings/navigation functionality is reused rather than rerunning the full regression suite.

Story paths are stable identities, but retention is not a guaranteed durable archive: warm-worker history, the shared cache and committed captures can be rebuilt or expire. New non-curated items may disappear after feed eviction/cold starts. Public archive guarantees and durable cross-worker notification claims require a separately approved persistence design; neither is claimed by this private pilot.
