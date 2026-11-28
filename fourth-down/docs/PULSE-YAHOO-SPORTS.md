# Yahoo Sports RSS — November 27, 2026

This is an additive source change on main after the compact-reader overhaul merged as PR #82 (85ba505). It does not replace the feed UI or reader, and is separate from the mobile playoff work.

## Primary evidence

- Yahoo's own RSS directory: https://sports.yahoo.com/syndication/ explicitly links College Football to https://sports.yahoo.com/college-football/rss/ . Both returned HTTP 200 during verification; the feed content type was application/xml. No inferred endpoint or article-page scraping is used.
- https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html , section “RSS Feeds”, permits displaying provided feed content without modification, requires source attribution and full-article links, prohibits incorporating advertising into the feed, and reserves withdrawal rights. This is the documented RSS-specific permission basis, not an assumption that a reachable URL grants reuse.
- The verified feed contained 50 items, including unrelated high-school/betting destinations. Only validated https://sports.yahoo.com/college-football/{articles,news,video}/*.html links are accepted. The first ten entries in the captured sample were accepted. Source/publisher credits supplied by Yahoo are retained separately from Yahoo Sports attribution.

## Display and bounds

Headlines and the complete plain-text feed description are preserved. Descriptions over the existing 500-character packet limit or containing markup/control characters are omitted rather than truncated or rewritten. Full content:encoded bodies are never displayed. The verified feed supplied no thumbnails; image hosts are deliberately empty, so the existing publisher-mark fallback is used. Article images are not fetched or invented. Future image support requires verified feed image hosts and a reviewed change.

Existing compact rows, reader dialog, Read Full Article browser links, stable story paths, filtering and session scroll restoration are reused. No article iframe, proxy, restricted-page scraping, inserted advertising or new subscription is added. ESPN/NCAA/FOX and inactive CBS/NBC policy remain unchanged.

Yahoo uses the existing public sports RSS switch and shared per-source hourly cache, zero retries, a five-second timeout, and bounded prefix transport that stops at ten complete RSS items within 512 KiB. This accommodates content:encoded in the actual feed without retaining or displaying article bodies as content. Source fanout maximum increases from nine to ten; two-worker concurrency, shared ten-minute packet freshness, retention/write cadence and schedules are unchanged. Incremental resource use is one hourly cached feed read per active cache region/fill, not a new paid service or a claim of exactly zero infrastructure use.

Validation is recorded in the PR. Unit cases cover permission configuration, exact metadata preservation, article-body exclusion, off-host/unrelated URL rejection, oversize descriptions, ten-item cancellation and redirect refusal. Browser checks use iPhone-sized WebKit; a physical iPhone remains a separate owner check.
