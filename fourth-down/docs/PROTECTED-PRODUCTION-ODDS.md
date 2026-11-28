# Protected Production odds — November 27, 2026

Normal use: open a game on an approved personal device; odds load automatically. No access-token form, hourly sign-in, manual capture button, or private lab. `/dev/odds` redirects to games.

## Device access

The existing flags FOURTH_DOWN_PRIVATE_ODDS and FOURTH_DOWN_PRIVATE_ODDS_PRODUCTION must both be true in Production. The existing ODDS_DEV_ACCESS_TOKEN is retained strictly as a server administration credential; it is never entered in the UI, bundled, or placed in a link. Provider credentials remain server-only.

An administrator POSTs `{person: 0}` (owner), `{person: 1}`, or `{person: 2}` to `/api/private/odds/devices` with the existing server credential as a Bearer header. The response contains a random, single-use approval valid for 24 hours. Send the intended person a game link with fragment `#approve-odds=APPROVAL`. Fragments are not sent to HTTP servers or in referrers; the client immediately removes the fragment before exchanging it through a same-origin POST. Approval redemption is atomic and stored only by SHA-256 digest in Redis.

The exchange sets a random 256-bit HttpOnly, Secure, SameSite=Strict cookie, scoped to `/api/private/odds`, valid for 180 days. The server stores only its digest and expiry. Three person slots permit up to four personal browser/device installations each; slots 1 and 2 are not automatically granted to anyone. DELETE the devices endpoint with `{person: N}` and the administrator Bearer header to revoke that person's devices immediately. Existing valid legacy cookies silently migrate into the owner's slot. Token-only session POSTs are rejected.

Browser storage deletion, a different browser/PWA installation, revocation, or eventual device expiry needs a new one-time approval. There is no way to securely recognize an unapproved browser without that initial approval. Approval links are private bearer capabilities: deliver directly to the intended person and never publish them in source or PRs.

## Safari, ChatGPT browser and installed PWA

These may have separate cookie storage. Opening a link in ChatGPT does not approve the installed PWA, and a consumed link cannot be reused. For this case administrators request `{person: 0, format: "code"}` from the existing protected devices endpoint. A random 48-bit, one-use approval code is returned, valid for 24 hours. The user enters it once in the Odds panel inside the actual PWA/browser. Codes accept spacing, dashes and either letter case. This exchanges for the same persistent secure device cookie; no developer token or provider key is entered. A shared Redis limit permits at most 20 manual-code attempts per 15-minute bucket, across instances. Existing link approvals remain supported. Separate installations need distinct codes.

## Capture and retention

Only November 26–28 Eastern dates remain enabled. The Vercel cron, scheduled only for November 27 and 28, invokes `/api/private/odds/capture` at 14:00 UTC (9 AM ET in November); it requires the existing CRON_SECRET, Production environment, and both feature flags. Outside the window it returns inactive without Redis/provider calls. No QStash schedules, push paths, or paid services change.

An authenticated pregame game request can perform a missing/stale date capture automatically. Live/final requests are cache-only. A date snapshot fresh within six hours is reused; after six hours a refresh may be attempted, but the original shared counters still allow only one date attempt per UTC day, three attempts/day and ten/month, reserving 5,000 points each. Failed/uncertain attempts stay charged. Provider usage headers are recorded; a low remaining reserve blocks more calls. Existing Free burst handling permits one retry only for an explicit transport throttle, never datapoint exhaustion. No quota counters are reset.

Snapshots expire within 24 hours of capture, replacing the erroneous six-hour expiry. Refreshes keep earlier pregame evidence in separately expiring keys with their original remaining lifetime; no new capture prolongs older prices' physical storage or visible lifetime. Current and retained snapshots are joined only at read time. Raw source payloads are discarded. Each quote carries its original capture and provider update time. A 9 AM Saturday capture lasts through Saturday night/final into Sunday morning; this is not permanent odds history. Missing live-game pregame prices are never reconstructed or fetched as in-play prices.

Game requests validate the real ESPN event, Eastern date, unique home/away name pair and kickoff. Captured pregame prices may display after kickoff, explicitly labeled pregame. A new fetch still accepts only future scheduled events. No matching event or no book/market price remains unavailable.

## Privacy and provider terms

Anonymous odds APIs deny before provider access. Without any cookie, they also deny before Redis access. Device cookies require one existing Redis lookup; admin operations require the server credential. Odds never appear in public SSR or client bundles. Responses are private/no-store and vary by Cookie and Authorization; the service worker does not cache them. The compact panel displays sportsbook, moneyline, spread, total, capture/update timestamps, minimum five-minute delay and attribution without developer diagnostics.

Primary sources checked November 27: https://therundown.io/free-sports-data-api and https://therundown.io/terms-and-privacy . Free permits delayed pre-match main lines from DraftKings, FanDuel and BetMGM for personal/internal use, with 20,000 daily / 200,000 monthly datapoints and a 24-hour storage limit. It does not grant unrestricted public/commercial end-user display. Three viewers alone do not establish licensing rights; private family sharing is not expressly confirmed. This release preserves the owner's stated personal-use boundary and does not claim provider approval for third-party distribution.

Rollback: disable FOURTH_DOWN_PRIVATE_ODDS_PRODUCTION and redeploy, or restore the prior deployment. Revocation is also immediate per person through the protected administrator endpoint.
