# Pulse RSS integration

PR40 now contains the actual reusable RSS adapters and news-first UI. It does not merge, deploy, enable push or change production data.

## Working experience

- For You: saved favorite teams and unexpired temporary team follows; explicitly labeled national FBS fallback when no team-specific stories match. Conference-wide context alone no longer prevents that fallback.
- National: current FBS headlines from ESPN/NCAA, source/time/exact original destination. FBS and FCS have separate tabs; FCS stories are not assigned to the FBS team directory.
- Team/conference/content filters reuse existing preferences without writing them. Trusted football feeds permit unambiguous school names; Miami/USC/shared mascots stay ambiguous. No game ID or matchup is invented from headline similarity.
- Compact headline cards, no copied body/summary/image. Publisher predictions and power rankings are labeled publisher analysis, not official committee rankings. News first, rather than an older featured video taking precedence.
- Exact canonical URLs/verified story identities deduplicate; similar headlines or article/video variants alone do not establish duplication. Original publication identity survives corrections. Seven-day default display; older items require explicit archive selection.

## Sources and operations

ESPN https://www.espn.com/espn/rss/ncf/news — shared30-minute source cache, honoring RSS TTL30.
NCAA FBS https://www.ncaa.com/news/football/fbs/rss.xml — shared15-minute source cache.
NCAA FCS https://www.ncaa.com/news/football/fcs/rss.xml — shared60-minute source cache.
All use pinned HTTPS destinations, manual/no redirects,256KiB/100-item/5-second caps, no credentials and no retries. Existing aggregate10-minute shared cache and private60-second HTTP cache remain; no timer/scheduler is added and visitors do not individually poll publishers. The adapter batch retains two-worker/eight-source bounds. The isolated review fetches only the three sports sources, not unrelated supplemental sources.

Three-source planning estimate:168 requests/day per shared cache filler; about3.06MB/day at the earlier measured53,317-byte combined feed sizes. Global cold-start/region amplification and Vercel billed CPU are not claimed measured. Source caps bound payloads; existing archive/command/retention safeguards remain. No new dependency, service, namespace, Redis initialization or subscription access.

## Private review and public release boundary

The prior source-rights finding is unchanged; implementation does not grant publisher rights. Static sportsRights entries remain null. No public adapter is silently marked granted. A deliberate local-only review mode supports real feed metadata without falsely declaring public permission:

`NEXT_PUBLIC_FOURTH_DOWN_PULSE_RSS_REVIEW=private-local-v1 NEXT_PUBLIC_FOURTH_DOWN_NEWS_PILOT=true npm run dev -- --hostname 127.0.0.1 --port 3040`

Requires development and no Vercel environment; production and hosted Preview ignore/reject this switch, even if copied into their configuration. Review-only items cannot enter a captured/public archive packet. The compact private-preview label remains visible. Production needs a reviewed source-rights record and separate owner deployment approval. No additional source research is needed to establish technical availability.

## Validation

63 focused tests passed: feed normalization, source policy/permission boundaries, exact links, original timestamps, no summaries/images, team ambiguity, FBS/FCS separation, national fallback, URL dedup, redirect refusal, archive/notification isolation and genuine captured RSS. Live local API fetched all three actual sources and a second request returned the same evaluatedAt/items, demonstrating local shared-cache reuse. This does not measure global cache amplification.

Desktop Chromium and iPhone-sized WebKit verified real-source cards, National/FBS/FCS views, metadata equality, exact destination/date, no images, reliable team filter, Tennessee national fallback, unchanged preferences and no API writes/page errors/overflow. Accessibility heading/role issues were found and fixed. Final lint/type/build results and screenshots are retained in workspace outputs/pulse-rss-integration. No redundant full regression suite; production scores, schedules, alerts, What If, Game Center and private PR19 are unchanged. November3 read-only CFP comparison remains prepared and actual publication remains unobserved.

Engineering recommendation: ready for review after final checks. Public news activation remains gated on documented publisher permission; do not present a merge of this branch alone as delivering public ESPN/NCAA news while rights entries remain null.
