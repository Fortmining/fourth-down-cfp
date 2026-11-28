# Pulse compact feed and reader — November 27, 2026

## User flow

Pulse presents compact, chronological rows with publisher identity, publication age, the full headline (up to three visible lines) and a square feed thumbnail. A publisher mark replaces unavailable imagery; no invented photograph or giant unavailable-image card is shown. Latest, Following, Recruiting and Transfer Portal are the primary filters. Team, conference, content, FBS/FCS and older-coverage filters remain in a compact secondary control. Existing team matching, classification, source reconciliation, archive, story IDs and sharing URLs are retained.

A headline opens a readable dialog immediately. The dialog uses only an already supplied, bounded feed teaser, publisher/byline/publication metadata and a validated feed image. It never fetches, proxies or frames article pages. Publishers supplying only a headline have a clear continuation to the full report rather than a fabricated summary. Read Full Article is a normal user-initiated HTTPS link with target=_blank and noopener/noreferrer so the publisher opens outside the reader, including in the browser supported by the installed app. No claim is made that an external publisher has loaded. Video links retain Watch Full Video.

Closing the preview or using browser Back retains the underlying rows, scroll position and active filter. The filter, loaded row count and scroll offset are also retained in per-tab session storage for a return from an existing story route or another Fourth Down destination. Public feed data is kept in bounded in-memory state for ten minutes; manual refresh remains available. No new polling, Redis namespace or scheduled service is added.

## Publisher feed verification

All discovery and endpoint checks were made against the publishers' own sites; a successful HTTP response alone is not considered permission to redistribute.

| Publisher | Official evidence and endpoint | Result |
| --- | --- | --- |
| FOX Sports | https://www.foxsports.com/rss-feeds links College Football to https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30&tags=fs%2Fcfb | HTTP 200 XML. The official index explicitly permits attributed non-commercial use by individuals/nonprofits. Connected under the existing sports RSS release switch. The published partnerKey is a public feed parameter linked by FOX, not an application credential. |
| CBS Sports | https://www.cbssports.com/xml/rss links College Football to https://www.cbssports.com/rss/headlines/college-football | HTTP 200 XML. Index describes individual feed use. https://www.viacomcbs.legal/us/en/cbsi/terms-of-use does not establish general in-app redistribution/image rights. Registered as permission-needed, disconnected; no automatic requests or public excerpts/images. |
| NBC Sports | https://www.nbcsports.com/college-football advertises an Atom alternate at https://www.nbcsports.com/college-football.atom | HTTP 200 Atom. https://www.nbcsports.com/terms-use limits use to personal viewing and does not establish in-app redistribution rights. Registered as permission-needed, disconnected; no automatic requests or public excerpts/images. |

Initial research samples contained 27 usable FOX college-football stories (23 accepted after sport/destination validation), 36 CBS entries and 8 NBC entries. Counts are observations, not guarantees of future volume. Unrelated NFL destinations, non-football pages, promotional betting paths, unsafe images, future timestamps and homepages are withheld by existing and exact new destination rules. No restricted article was scraped or access control bypassed. CBS/NBC can be considered in a future reviewed permission change; this release does not claim that they were integrated as live sources.

Existing ESPN, NCAA FBS/FCS, Army/DVIDS and permitted syndication sources remain as configured. ESPN/NCAA remain headline-only under their existing owner-authorized configuration; this change does not expand their excerpt or image permissions. The FOX reader consumes its supplied description, never content:encoded/full article HTML, and accepts thumbnail URLs only from the observed publisher-owned feed image hosts. Attribution and original article URLs are retained.

## Bounds and scope

FOX is checked at most hourly through the existing per-source shared cache; no retries are added. The source fanout cap moves from eight to nine with the same two-worker concurrency, timeouts and feed byte/item limits. Shared feed freshness and archive write cadence are unchanged. The cache version changes only for Pulse so new adapters can appear on release. No paid services or provider keys are introduced.

Odds/device authentication, scores, notification delivery, QStash and playoff features are outside this change. Pulse's separate observation/event infrastructure is retained but its large developer-style panels are removed from the ordinary news feed. Existing standalone story/share routes continue working without an intermediate iframe action.
