# Pulse 2.0 private reader — November 24, 2026

## Implemented; production not activated

The intelligence route supports `PULSE_CFBD_READ=cloudflare-v1`. Server-only
variables are `PULSE_CFBD_ACCESS_CLIENT_ID`, `PULSE_CFBD_ACCESS_CLIENT_SECRET`
and `PULSE_CFBD_ORIGIN_BEARER`. Never use NEXT_PUBLIC variables. The fixed origin
is https://cfbd.fortmedia.cc; callers cannot select hosts, paths or headers.
The legacy local-file and separately approved Redis modes remain unchanged.
No environment variables, production resources or schedules were changed.

The new reader uses GET, both Access headers and the independent origin bearer,
rejects redirects, aborts after four seconds (including body streaming), rejects
non-JSON, invalid schema, wrong-team and over-24-KiB responses, and only accepts
registered team IDs. No provider body or credential is logged or returned.

Validated views and origin ETags are cached for six hours per warm function
instance. Simultaneous reads for the same team share one request. On expiry,
If-None-Match permits a 304 only when a validated body exists. A network, 5xx or
validation failure retains the previous edition up to 24 hours after its last
successful validation, retries after one minute, and marks the response stale.
A cold instance with a failure returns unavailable. A 401/403/404 removes cached
data. Credential changes discard the cache. This memory cache is bounded by the
team registry, adds no service or Redis usage, and provides no cross-instance
or restart durability. Dataset observation times remain visible in existing UI.
Stale and unavailable API responses are no-store; healthy data has a five-minute
public browser cache. This route intentionally exposes only approved derived
views; it never returns the upstream authentication headers or raw CFBD feeds.

## Private external check (pending credentials and DNS)

Create an owner-only JSON file outside Git with the three server variable names
above and their values, supplied through the owner's secret manager. Mode 0600.
Run `python3 scripts/check-cfbd-private-reader.py --credentials-file /PRIVATE/PATH`.
It checks Access denial, origin bearer denial, authenticated team response,
SHA-256 ETag and empty 304. It prints only pass/fail information, never bodies,
headers or secret values. Do not pass values on command lines or paste into chat.

Then add the three sensitive variables and the opt-in flag only to the existing
project's isolated preview scope for feat/pulse-2, after owner credential access
is arranged. Verify the preview intelligence response for 2633, 61 and 2483;
verify derived-only data, no credentials in browser traffic, warm cache behavior,
ETag revalidation and a controlled unavailable origin. Local automated tests
cover these failure modes but do not prove live Cloudflare or hosted reachability.
The local publisher smoke test remains in ops/proxmox/TEAM-VIEW-PUBLISHER.md.

## Atomic refresh preparation (not installed)

Install the updated staging script into /opt/fourth-down-reader and install
ops/proxmox/pulse-cfbd-stage.service into /etc/systemd/system. Install
ops/proxmox/pulse-cfbd.service.d/publish.conf into
/etc/systemd/system/pulse-cfbd.service.d/publish.conf and daemon-reload after
review. This adds no timer. On successful collector exit, the root staging unit
acquires the collector's worker.sqlite.lock, validates every registered team
before publication, and replaces each file atomically with fsync. The reader
retains access only to /srv/pulse-cfbd-read. Root staging needs no credentials.
The live publisher retains its directory handle, so files are replaced inside
the existing directory. Do not replace that directory or switch its symlink.

Atomicity is per team; it is not a transaction across all 138 files. Individual
responses always read one complete old or new view. If validation fails before
publication, all published files remain unchanged. Disk failure during the copy
can leave a mixture of complete old/new team views; retry after repairing disk.
Handled provider errors may still exit zero: verify cf_checks and cf_calls,
not service success alone. Previous editions can be republished unchanged.

## Second controlled ingestion gate

Keep collection and backup timers disabled. Before starting, read-only query
/var/lib/pulse-cfbd/worker.sqlite for MAX(at) in cf_calls and verify the CT clock.
Wait strictly more than 24 hours after the last reservation; never delete the
ledger to force a call. Run one manual pulse-cfbd.service, inspect endpoint
results, quota sample/cooldown, per-scope coverage, retained revisions and SQLite
quick_check as documented in ops/proxmox/README.md. Verify complete validated
publisher copies, external ETag changes for changed views and unchanged ETags
for unchanged views. Run one manual backup and verify its integrity. Record
actual calls and observed dataset coverage. This step remains unverified here.

## Schedule proposal and release gates

Existing proposal: collector wakeup every four hours at :14 UTC, with per-dataset
admission and shared rolling quota caps; backup daily 03:35 UTC. These are
proposals only; both timers stay disabled until explicit owner approval. Review
season/class year, current quota, the second cycle, storage and private backup
restore before activation. Persistent timers can run immediately when enabled.

Release is NOT ready until authenticated external access, isolated Vercel
preview, second controlled ingestion, refresh and backup are verified. Complete
broader Pulse feature/coverage and desktop/iPhone preview review separately;
infrastructure readiness is not evidence that live portal, signing or alert
features are complete. Production deployment and timer activation require
separate approval. Preserve production Upstash and existing game/alert schedules.

References: https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/

## Live commissioning update — November 24

Restricted SSH through fd-pulse@192.168.1.75 was verified inside CT 260.
The actual protected hostname is **cfbd.fortmedia.cc**, as confirmed in both the
Cloudflare application and CT tunnel configuration. The earlier formedia.cc
spelling was a handoff error. No DNS or Access policies were changed.

External tests passed: unauthenticated Access denial (403), valid Access token
without origin bearer denied (401), both credentials returned a bounded,
schema-validated team view (200), correct SHA-256 ETag and empty conditional 304.
The Python library default user agent received Cloudflare error 1010; both
clients now identify themselves as FourthDownPulseReader/1.0. This follows
https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/
and requires no relaxation of security settings.

The actual Node reader validated Tennessee (2633), Georgia (61), Oregon (2483),
each with five datasets. Warm cache avoided repeated network reads, conditional
revalidation succeeded, and a controlled transport outage retained the previous
live-validated edition. These reads made no CFBD API or Redis calls.

The staging script, service and collector OnSuccess hook were installed in CT
260, with a root-only rollback copy of previous files. One manual staging run
passed for all 138 views. Collection and backup timers remain disabled.
The ingestion ledger contains eight reservations, last at 2026-11-23 23:09:21 UTC.
Second collection must wait until after 2026-11-24 23:09:21 UTC (6:09:21 PM EST).
At this check, SQLite quick_check was ok. Portal, roster, season stats and
advanced stats covered 138 teams; recruiting observations covered 135. Missing
coverage is not interpreted as zero. No new provider collection was run.

## Hosted reader validation

Vercel preview dpl_A1wEa4vNYNAvbt7h61r8maK1bmkS is READY at
https://fourth-down-fw81sjmu4-fortmining.vercel.app and was built from commit
c4f061d0d6a77b5558d49a4a9043ae2e6e241aec. Credentials were supplied only to this
preview deployment through the CLI process environment; values were not placed
in command arguments, source files or logs. Branch-scoped project settings
could not be saved because feat/pulse-2 has not been pushed to GitHub. All such
save attempts failed; project-wide preview and production variables were not
changed. An initial preview without credentials was canceled before validation.

Authenticated requests through the Vercel CLI confirmed available=true,
matching team IDs and five datasets for 2633, 61 and 2483. An unknown team
returned available=false. This verifies Vercel → Cloudflare Access → CT 260 →
validated derived views. Local real-network Node tests separately verified
warm cache reuse, live conditional revalidation and controlled outage fallback.
The six focused reader/schema tests passed after the hostname and User-Agent
corrections. The production build passed; the hosted final commit build is READY.
The previous full regression run remains 627/632 with five documented baseline
failures; unrelated tests were not rerun for these host/header corrections.

A manual online backup completed and quick_check returned ok; it retains the
same eight reservations. All 138 source and publisher views validate and match.
Reader account checks denied filesystem access to the CFBD key, SQLite database
and backups. Final production alias still resolves to
production deployment dpl_9wCA7mLs81ZXtukVRYpTJL4ZWV5q. No production deployment,
Upstash operation, DNS/policy change, provider ingestion or timer activation
occurred. The dedicated reader remains active; both worker timers are disabled.

Next gate: after 6:10 PM Eastern on November 24, re-read the latest reservation
and synchronized CT clock, then run one controlled collection, stage and verify
views, compare ETags/revisions and verify a new backup. Do not force retries or
clear the ledger. After that, review actual dataset coverage, the broader Pulse
feature gaps and hosted desktop/iPhone experience before asking separately for
production release and ongoing collection/backup schedule activation.

## Controlled early second ingestion — owner-authorized November 24

The old 24-hour commissioning gate was a local policy, not a documented CFBD
mandatory cooldown. The owner authorized evaluating a shorter interval. Official
monthly/shared-pool terms were checked, and a direct private account check
reported 982 remaining of 1,000, 18 used, reset December 1 at 00:00 UTC.
The first run's last reservation and successful season-stat check were
November 23 23:09:21 UTC (6:09:21 PM EST).

A single-use --controlled-second-run option now permits the second commissioning
run after 12 hours and before 24 hours. It requires the original first-run ledger
(at most eight prior rolling-month reservations), no active provider cooldown,
the normal exclusive worker lock and a durable second-v1 claim. It allows at
most 16 total rolling-day reservations while preserving the 250 rolling-month
cap, 100-call provider reserve, failed-attempt accounting and error cooldowns.
Daily datasets use a 12-hour interval only in this mode; weekly intervals and all
normal automatic admission rules remain unchanged. Reuse is rejected even after
restart. No ledger was erased or reservation reclaimed. Nine focused scheduler
tests cover the normal/controlled admission, quota floors, cooldowns, revisions
and durable single-use gate. Failures now log exception class only, never request
headers, provider payloads or credential values.

The controlled unit started November 24 at 14:07:08 UTC (9:07:08 AM EST), roughly
14 hours 58 minutes after the original run. It completed in 29.381 seconds with
five additional reservations (13 total). Quota sampling, portal, recruiting and
advanced statistics completed. National player-season statistics returned a
handled transport/validation failure; no successful player-stat edition was
published. The original log did not distinguish its exception type. Do not claim
complete player-leader coverage or infer zero players from that failure.

All 138 derived team views validate, match worker exports, and were copied by
the atomic staging service. Every view's ETag advanced because observation times
changed; fact revision changes were zero. Portal, roster, season statistics and
advanced statistics cover 138 teams; recruiting covers 135. Class rankings and
player-season editions remain absent. Roster and season statistics retain their
previous observations because weekly refresh was not yet due. Missing records
remain unknown, not zero. A post-run online backup passed quick_check and
preserves all 13 reservations. The fresh account check reports 978 remaining,
22 used, 1,000 monthly limit. Four metered data requests were consumed; the
local ledger conservatively also counts the info request.

This retires the earlier requirement to wait until 6:10 PM for the second
commissioning run. It does not approve unattended collection, repeated manual
exceptions, production release, or changing shared production Upstash.

## Pulse 2.0 release candidate — November 24

Player-season failure was an implementation/request-size problem: the broad
national request exceeded the bounded download path. A quota check succeeded;
no 401/403/429 was observed. Three category-scoped requests (passing, rushing,
receiving) succeeded under the existing 12 MiB per-response guard. They returned
7,231 / 16,520 / 21,645 provider rows and produced validated, bounded leader
summaries for all 138 FBS programs. The worker now reserves all three HTTP
attempts atomically, counts each against daily/monthly budgets, and publishes
only after all categories succeed. A partial batch retains the previous edition.
The player request timeout is 45 seconds; other endpoint timeouts remain 15.
Normal collection wakeups and daily caps are unchanged. Planned monthly maximum
is now 159 attempts versus the 250 local cap and 1,000 provider allowance.

The authenticated 2027 class-ranking response was HTTP 200 with an empty JSON
array (two bytes), matching the documented response schema. This is missing
provider coverage, not an authorization/quota rejection or a dropped nonempty
response. The UI explicitly says the 2027 class ranking is unavailable while
reported commitments remain usable. No 2026 ranking is substituted for 2027.
Player-leader absence and stale/unavailable origin responses also have clear
states. The Pulse page metadata now describes connected news and intelligence.
Filters wait for initial URL/preferences hydration so early selections cannot
silently reset. No Pulse push delivery was activated.

A single-use, audited repair batch recorded three category reservations after
three diagnostic reservations (quota check, empty class rankings, bounded full
player diagnostic). The ledger now contains 19 reservations. An explicit manual
repair ceiling of 19 was used only for this batch; the normal eight-per-day
admission was not raised. Last account sample: 973 of 1,000 remaining, 27 used,
reset 2026-12-01T00:00:00Z. Only five metered diagnostic/repair data requests were
needed for this investigation. Raw diagnostic/category captures stay private in
CT 260; they are not served by the publisher or committed to this repository.

Live coverage: 138 transfers, rosters, analytics, team-statistics and player
leader summaries; 135 recruiting summaries; zero 2027 class rankings. All 138
published summaries validate; maximum size is 6,270 bytes. SQLite and the latest
online backup pass quick_check and retain all 19 reservations. Both timers stay
disabled. Normal future jobs can defer while the manual reservations age out.

Release validation uses scripts/pulse-2-release-check.mjs against a production
build with real private-origin summaries. Desktop Chromium and iPhone-sized
WebKit pass team comparison, player leaders, recruiting, explicit absent ranking,
historical-transfer wording, controlled stale/missing/outage states and recovery,
WCAG 2 A/AA and 2.1 AA checks, widths 320/390/430/1280/1440, no browser credential
headers, no mutations, and no page errors. Physical-device Safari and OS push
are not claimed. The local live-news response contains 57 real stories; the
team-specific feed can correctly be empty when no matched stories exist.

The previous five regression failures were stale test harness issues. Diagnostics
now import the real worker-diagnostics helpers into the VM mock; runtime alert
code is unchanged. The terminology scanner no longer matches a literal accented
word inside its own negative-check browser script; the runtime check is retained.
The 632-test JavaScript suite passed, as did 11 scheduler, three ingestion-base
and five publisher/staging Python tests. A final repeat of the suite is recorded
with the release artifacts. Production build, type/lint gates and browser checks
pass. The latest main commit is an ancestor of the release source, so current
production Redis fixes are retained. No production code/config deployment or
Upstash operation occurred; ongoing schedules still require separate approval.

Recommended release scope: sourced news, historical transfer observations,
reported recruiting and team intelligence, with provider gaps labelled. Keep
CFBD automatic collection/backup timers and Pulse news push off. Activation
requires the three existing server-only read credentials and
PULSE_CFBD_READ=cloudflare-v1 in Production, followed by an explicitly approved
production deployment and sanitized smoke checks. Roll back the deployment or
remove the read opt-in if team intelligence fails; do not reset the worker ledger.
