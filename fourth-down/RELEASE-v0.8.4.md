# v0.8.4 — Fresh notification feeds

Scheduled alert detection now requests ESPN’s current scoreboard and current rankings with `cache: no-store`. Normal `/api/live` visitors retain the 60-second fetch cache and public 60-second cache / 120-second stale-while-revalidate response. Historical rankings and upcoming schedule lookups retain caching. A failed fresh scoreboard request is unavailable; it does not masquerade as a fresh successful cached response.

Source request, response, and parse times, HTTP Date/Age, ETag and Last-Modified (when provided) are recorded in protected scheduler diagnostics. Selected game delivery attempts retain the scoreboard source trace. These are observation timestamps, not ESPN’s first publication time. Existing notification eligibility, opt-in, favorites, temporary follows, event identities, cooldowns and delivery receipts are unchanged.

## Evidence and limitations

An installed-Next.js cache replay reproduces stale Live being returned during background revalidation despite a Final origin response. The fresh alert path sees Final immediately and emits one final event. This is a simulated regression, not proof of the historical source’s first Final time or a new real delivery.

The pre-change Tennessee–South Carolina final had 431.489 seconds between ESPN’s End-of-Game play wallclock and the server’s browser-display acknowledgment. Detection to provider acceptance was 310 ms; provider acceptance to display acknowledgment was 990 ms. The exact first Final publication time was not retained, so source delay, caching and polling cannot be apportioned conclusively. A browser acknowledgment does not prove when iOS showed a banner to the person.

Four-minute polling remains in production. The cache fix removes an avoidable revalidation cycle, but cannot guarantee one-to-two-minute delivery with a four-minute poll or eliminate upstream ESPN delay. Real post-release event measurements remain pending and must be labeled separately from simulations.

## Polling decision: hold

No scheduler, plan or billing changes are included. Current four-minute checks use 360 scheduled messages per day. Two-minute active / fifteen-minute inactive checks would use 408 messages on a hypothetical 12-hour active day (96 on an entirely inactive day). This is a scenario, not a measured daily active-game profile. The native QStash console shows 1,000 messages/day on Free, while the installed Marketplace plan description shows 500; either covers that scenario, but the discrepancy needs resolution before relying on higher volume.

The fifteen-minute interval is unsafe with the current six-minute health window and five-minute normal event-baseline window. Kickoff recovery has separate bounds, but does not make all other alerts safe across fifteen-minute gaps. A future adaptive scheduler needs pre-kickoff warmup, overlap-safe scheduling, ranking-release coverage, health/baseline adjustments and measured busy-day Redis/delivery totals before activation. Current Redis dashboard usage is approximately 25K/500K monthly commands, 298 MB/10 GB bandwidth, 10 MB/250 MB storage and $0.00. No paid upgrade is authorized.

## Validation

185 automated tests pass, including stale cached Live → fresh Final, repeated Final deduplication, unavailable fresh feed, public-cache isolation, current-ranking freshness, delayed polls inside the normal window, and preserved safety behavior outside it. Production build, lint and TypeScript checks pass. Mobile browser checks use simulated server/worker responses and cannot establish physical iPhone notification delivery.
