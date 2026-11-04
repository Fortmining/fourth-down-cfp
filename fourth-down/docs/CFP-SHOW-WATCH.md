# Bounded CFP Selection Show checks

The four-minute dispatch schedule stays in place. A separate QStash POST to
`/api/alerts/cfp-show` uses the existing worker bearer authorization. The route
checks the absolute 2026 broadcast window before touching storage or sources.
A Redis minute claim limits duplicate invocations to one source check per minute.
The normal dispatcher verifies the ESPN feed again before sending, using the
same lock, preferences and persistent edition claim as the four-minute path.

Committee release links are an independent availability signal. The HTML link
does not prove the complete rank list, so it cannot trigger a send. Only the
ESPN complete 25, with the correct season and show date, can request dispatch.
Each source has one bounded, five-second request with no redirect or retry.
The log records first observed availability when ordered by the minute slot,
not the first publication instant. Join its edition event ID with the dispatch
observation, provider attempt and acceptance, and browser receipt audit. A
browser receipt does not verify an observed operating-system banner.

Use the existing QStash project, no retries for the supplemental probes, and
the following Eastern cron expressions. Remove the jobs after their dated
windows. The route rejects a later year even if jobs are left in place.

| Show | Cron with `CRON_TZ=America/New_York` |
|---|---|
| November 10 | `0-29 21 10 11 *` |
| November 17 | `0-29 21 17 11 *` |
| November 24 | `30-59 19 24 11 *` |
| December 1 | `0-29 19 1 12 *` |
| December 6 | `* 12-14 6 12 *` |

Source: https://collegefootballplayoff.com/news/2026/8/6/sc-aug-2627

At most 300 additional scheduled invocations across the five shows. The
largest day is 180 supplemental messages plus 360 routine messages before
retries and other account traffic. Upstash lists 1,000 messages/day and 10
active schedules on Free. Confirm actual account headroom before activation.
There are at most 600 source requests and 600 Redis commands for the probe
paths across the five windows, excluding existing worker work when a newly
observed edition triggers dispatch. Vercel CPU and transfer charges are not
measured. Delayed releases outside the broadcast window use the normal worker.

Source: https://upstash.com/pricing/qstash
