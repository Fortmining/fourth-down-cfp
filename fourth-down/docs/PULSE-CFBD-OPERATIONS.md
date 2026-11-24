# Pulse team observations

Run the existing Python worker from a private, persistent volume. The example in
`ops/pulse-cfbd.crontab.example` wakes every four hours without a browser. The
worker reads a server-side CFBD_API_KEY. Set the football season and recruiting
class year explicitly. Installing this job, attaching a credential, or enabling
the Vercel reader is a separate operational action.

| Interval | National endpoints |
| --- | --- |
| Daily | /info, /player/portal, /recruiting/players, /stats/season/advanced |
| Weekly | /teams/fbs, /roster, /recruiting/teams, /stats/season, /stats/player/season (three category-scoped requests: passing, rushing, receiving) |

A 31-day month needs at most 159 requests on this schedule. Hard admission limits
are eight attempts per rolling day and 250 per rolling 31 days. Every attempt is
committed before dispatch, including failures. The daily /info sample must be
at most 30 hours old and leave over 100 shared calls after local reservations.
Other clients can consume that shared balance after sampling. A 401, 403 or 429
stops collection; a 429 holds subsequent requests for at least one day. A
national response exceeding 12 MiB is rejected and the last edition retained.
The API offers season filters; these reads do not assume a change cursor.

SQLite WAL is the authoritative store on **one** persistent worker, with an OS
lock for overlapping jobs. Use a private, backed-up volume and SQLite's backup
API. Keep the database, WAL, lock and private views directory together across
restarts. Deployment-local Vercel storage cannot serve this purpose. Normalized
facts are stored privately with the latest four changed editions per school and
dataset. A repeated observation updates freshness. A missing program retains
its previous observations with an explicit missing-from-latest marker. A failed
or empty nationwide read leaves prior observation times intact.

For co-located local review, PULSE_CFBD_VIEWS_DIR points to the generated views
directory. The authenticated Vercel probe used a temporary database and retained
only counts. It cannot seed this store. A separately managed persistent worker
would need the existing credential injected securely there before live collection.

For hosted reads, the optional Redis mirror is disabled by default. Use it only
with a separate, approved database for derived views. A namespace on fourth-down-push
still shares the notification quota. Local review uses the private worker volume;
a hosted read-only artifact store is an alternative once approved. It needs a write credential restricted to
`fd:{cfbd-views-v1}:team:*` on the worker (PULSE_CFBD_REDIS_URL/TOKEN), plus a
read-only credential for the same namespace at the application
(PULSE_CFBD_REDIS_URL/READ_TOKEN). Enable PULSE_CFBD_PUBLISH=approved-v1 on the
worker and PULSE_CFBD_READ=approved-v1 on the reader separately. No production
keys, credentials or schedules are created by these changes.

The mirror issues up to 24 SET attempts per run, 144 per rolling day, with a
24 KiB ceiling per team and 14-day expiration. Bounded reads use a six-hour
shared cache and validated registry IDs. One fully requested 138-school cache
population is 138 GETs, or 552 GETs/day in a single cache partition before
eviction or concurrency. This is a planning estimate; Vercel cache partitioning
and misses can increase actual usage. A failed mirror never rolls back SQLite.

Recruiting, transfer history, roster, season leaders and analytics are provider observations.
Signings and enrollments keep their existing school-sourced ledger. The public
reader permits aggregate facts and a small selection of prospects and movements
per program. It has no raw-download, historical-dump or arbitrary query interface.
