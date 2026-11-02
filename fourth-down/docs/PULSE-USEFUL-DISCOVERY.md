# Pulse discovery and permitted source expansion — November2

## What can improve now

For You and Home show matching favorites/active temporary follows first. If none match, show available college-football items with an explicit Around College Football fallback label. A selected Team Page/filter remains strict and never borrows unrelated stories. No expired content is made fresh to fill an empty screen. Exact original URLs are deduplicated; verified story keys retain cross-publisher clustering. Similar headlines alone are not sufficient evidence of syndication.

Add visibly separate official newsroom navigation (Tennessee, national NCAA football, SEC). These are publisher destinations, not news cards or substitutes for exact article links. News cards retain exact original article links, publication times, author/source credit; independent publishers are not called official team news.

## Source evidence and actual limitation

States Newsroom explicitly permits automated RSS ingestion at https://statesnewsroom.com/rss-feeds/ and republication at https://statesnewsroom.com/republishing-guidelines/. Credit publisher/web address/author, link original, no story sale/paywall/targeted story ad sales. Three additional source adapters: Tennessee Lookout, Kentucky Lantern and national Stateline. Only headline, exact article URL, publisher/author and dates are retained. No excerpt/body/image copied. Broad policy/business journalism is filtered strictly to college-football contexts, not treated as a daily sports wire. State geography never assigns a team.

Actual bounded retrievals succeeded for all three, using complete first10 RSS items: Tennessee167,994bytes, Kentucky96,560, Stateline141,110. **Zero qualifying college-football items in these current windows.** Search-feed variants returned403 and were not retried/bypassed. This work does NOT increase verified automatic program-specific coverage beyond Army1/138. Report supplemental source configuration separately from actual retrieved story/team coverage. Owner's daily Tennessee/national coverage objective remains blocked by lack of a permitted relevant feed.

ESPN RSS index/news returned verification challenges; no approved public reuse grant was established, and no private news API or alternate-host bypass was used. NCAA RSS is published at https://www.ncaa.com/rss but reuse review remains unresolved. Tennessee/Texas/Ball State and conference RSS discovery does not override https://sidearmsports.com/sports/2022/12/7/terms-of-service sections2.1–2.3 restricting nonpersonal copying/storage. They stay disconnected. FOX RSS free-use eligibility is unresolved: https://www.foxsports.com/rss-feeds. No paid provider, key, login, subscription or publisher contact created.

## Bounded ingestion

The new prefix reader cancels after10 complete RSS items or512KiB read, whichever occurs first; malformed/oversized/DTD input is withheld. Chunked CDATA/comments cannot counterfeit item boundaries. It uses pinned registered URLs, no redirects,5second timeout, zero retries. Each supplemental source uses existing shared hourly cache; aggregate display remains10minutes, two concurrent adapters, eight-adapter ceiling. No changes to score processing, notification schedules or Pulse push (OFF).

Single-cache-fill planning bound: Army144 plus3×24=216 publisher requests/day, versus144 without these additions. Worst application-consumed RSS payload18MiB Army +36MiB supplemental/day; actual three-prefix review approximately396KiB total. These are per-cache-fill estimates, not a global account-wide cap or measured Vercel bill. Regional cache amplification/billed CPU unmeasured. Existing512KiB/200-item archive, two existing keys, mutation quotas and retention remain unchanged; no namespace initialized or production writes performed. No additional Redis operation per visitor is introduced.

## Release recommendation

GO for honest fallback, attribution and official newsroom discovery after owner approval. Supplemental feeds are safe and low-volume but **NO-GO for claiming daily national/Tennessee news coverage is solved**. A source license/explicit publisher grant or owner-approved authorized provider is still needed. Do not spend on providers or enable restricted feeds without approval. Fixture browser tests do not establish live content coverage.

Focused tests cover streaming byte/item limits and cancellation, unsafe XML, metadata/attribution, article URL allowlisting, CFP context, strict personalized/team filters, exact-URL dedup and notification/archive isolation. Desktop/iPhone-sized WebKit sample replay passes fallback, no cross-team leakage, original newsroom links, unchanged preferences and zero axe violations/overflow/API writes/page errors. Sample fixtures remain explicitly labeled and isolated. No Preview or production deployment; PR19 and November3 verification workflow unchanged.
