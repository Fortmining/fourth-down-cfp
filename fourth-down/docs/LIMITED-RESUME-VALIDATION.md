# Limited confirmed Resume release validation

## Final evidence

- Isolated branch starts at production/main `510e785`; no private/canary endpoints, benchmark controllers or deployment middleware are included. Automatic Git deployment is disabled for the release branch. PR19 stays draft/unmerged.
- Full isolated suite: **298 passed, zero failures**, with test concurrency2. Two additional production-adapter tests passed: dormant gating, fixed namespace, no reader-side publisher/history work, original evidence dates, wrong-season rejection and zero storage construction on unchanged captures. Total300 distinct passing tests.
- Type checking and lint passed. Enabled production build passed; a final frozen-source build is recorded separately. Existing nonblocking Next ESLint-plugin warning and Node typeless-module warnings remain; they are not new runtime failures.
- Built UI passed Chromium desktop, Firefox desktop and iPhone-sized WebKit: captured2026 baseline, controlled confirmed final through file-backed history and the injected browser display packet, explained Movers & Losers, exact resume-position labels, official-poll separation, dated records, team/game links, Follow Team cancel/modal-refresh protection, offline dated fallback, widths320/390/430/1280 and automated WCAG2A/AA/2.1AA. These are simulated browser/device layouts, not a physical iPhone or real new game observation. Synthetic result screenshots are visibly labeled.
- The full suite includes existing scores, current records, schedules/team data, favorites, Watchlist, preferences, rankings, push provider/worker, final/ranking/kickoff/deduplication/cooldown regressions. The new optional-publisher failure test confirms a favorite final was sent before resume work and remains successful when that work throws.
- Early isolation checks exposed missing offline test helpers, now restored. The unconstrained test run also exceeded two functional tests' real elapsed deadlines under concurrent machine load. Those functional tests now inject a monotonic test clock; production deadlines were not raised or removed. Deadline/failure protections remain tested separately. Browser locator corrections distinguish Tennessee from Middle Tennessee and the app warning from Next's route announcer; no product behavior was changed to hide a failed assertion.

## Hosted evidence and limits

The corrected authorized cache canary passed, used39/64 requests,19,415,040/33,554,432 reserved response bytes, concurrency<=4 and zero Redis/ESPN/notification requests. It was removed and provider404 verified. The earlier hosted Redis test passed separately; it was not repeated. Neither proves a real2026 final changed the deployed public page. Billed Vercel CPU and actual visitor traffic remain unmeasured. The default private cache remains60 seconds; the proposed public adapter's five-minute interval/negative caching/invalidation were locally tested, not observed for five minutes in a new hosted run.

## GO / exclusions / approval

GO for the small, gated confirmed-results release and guarded initialization, subject to explicit final production approval and a valid reconciled2026 packet before public announcement. Preserve existing schedules, services, credentials and preferences. The new endpoint has a truthful empty state if initialization fails; disable activation and investigate rather than fabricate a current record.

Public scope: Team Resumes, explained Movers & Losers, remaining tests, evidence, conditional disclosures and separately published official polls. Original dates remain visible during outages. Exclude brackets, probabilities, guaranteed conference/playoff qualification, live provisional movement, public full-history browsing, model expansion and AP notification issue21.

Approval needed: merge the isolated release PR, deploy through the existing Vercel production workflow, configure the two release flags and initialize only the fixed resume namespace from the already-fetched verified feed. Verify the first packet and production regressions; do not alter polling, existing credentials, subscriptions or service plans. The operating design and bounded small-launch assumptions are in LIMITED-RESUME-RELEASE.md.
