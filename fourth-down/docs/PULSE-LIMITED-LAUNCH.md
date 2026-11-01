# Limited Pulse release candidate — October 31, 2026

## Decision and scope

Recommend a limited **official-source news beta**, subject to owner approval and passing the production preflight below. Nationwide live coverage or a connected highlights service is not required for this narrow release and is not claimed.

Release: /pulse, Home/Team integration, national and personalized discovery, exact original links, stable attributed Fourth Down story pages, branded sharing, transparent source/coverage controls and separate local preference drafts. New visitors with no saved teams land on available national content. Existing preferences are preserved. Pulse push is OFF.

Live retrieval: Army official RSS, ten-minute shared on-demand refresh. Currently one verified Army–Memphis article; related teams Army and Memphis, American Conference. Configured automatic team source: Army only. All 138 FBS teams supported; 137 lack their own verified automatic source. One editorial Army–Navy spirit video is available in older content; it is not live game highlights. No invented cross-conference stories. KFF remains Preview-only research and is omitted from public ingestion.

Official YouTube publisher destinations verified October 31 from conference-owned links: ACC Digital Network, Big 12, SEC, Mountain West, Conference USA and Pac-12. These are ownership-verified destinations, NOT API-verified channel IDs or active sources. Exact channel/playlist pinning, an approved server key, API policy/privacy compliance and an explicit account quota are still needed. Legacy vanity URLs are not guessed into channel IDs. The documented channels.list resolver uses one reserved unit. Runtime supports at most four explicitly enabled channels within the existing eight-source batch ceiling and reserves two units before each two-call batch, including failed calls. It does not silently select favored conferences. No existing approved key was found; no credentials were created. These gaps do not block the RSS-only beta.

## Story persistence and isolation

New, default-OFF storage code uses exactly:

- fd:{pulse-stories-v1}:archive
- fd:{pulse-stories-v1}:meter

No subscription, scheduler, scores, resume or existing application key is referenced. It reuses the existing approved Redis REST service only after production release AND archive flags are explicitly enabled. Preview never obtains storage access. No new infrastructure, credentials or hosted benchmark was provisioned.

A single atomic Lua transaction meters accepted operations and protects generation-based compare-and-swap commits. The transport returns base64 payloads and prefixed generation strings to avoid JSON auto-decoding differences. No transparent write retry after an ambiguous response. The next refresh re-reads the authoritative state; stale writers cannot overwrite it.

Bounds: 200 story records, 4 revision fingerprints per story, 180-day news retention and automatic key expiration; decoded archive <=512 KiB, stored transport envelope <=700,000 bytes. YouTube metadata expires after 30 days without verification. Retractions/conflicts suppress original sharing; delayed originals do not overwrite corrections. An absent feed item alone is not treated as publisher deletion. New-source ingestion remains conservative.

The shared display cache refreshes every ten minutes; direct story lookups use that same persisted archive packet, without another Redis read, with separate production/Preview cache identity. No per-user publisher polling. Public feed items are withheld when persistent storage/commit cannot be confirmed. Score alerts continue independently. No new background schedule is added: ingestion is request-driven, so an idle site does not promise immediate discovery.

## Operating assumptions

Measured local archive: 2 records, 2,719 decoded JSON bytes before base64 transport; storage envelope approximately 3.7 KiB. This is local measurement, not hosted storage usage. Previous hosted feed and branded-image measurements remain applicable to unchanged assets; the refreshed Preview result is recorded separately.

Per accepted operation, including EVAL and nested commands: read=4 commands/1 mutation/2 reads; commit=5/2/2; YouTube quota reservation=3/1/1. Accepted-operation limits: 2,000 commands, 600 mutations, 1,500 reads and 100 MB serialized payload per UTC day. A reservation is not refunded after a failed provider call. API quota must be explicit, 1–5,000 units/day; no Google default quota is assumed.

The meter does NOT cap all account-wide billing: rejected EVAL calls, HTTP framing, other app keys and unrelated traffic still consume resources. Shared caching, zero retries and conservative failure responses reduce amplification; global cold-start/visitor amplification and Vercel billed CPU remain unmeasured. Do not describe the counters as an account-wide hard spending cap.

At one shared fill per ten minutes: 144 reads/day, 144 Army fetches/day, plus commits only when archive changes. With two changed commits, approximately 586 accepted Redis commands and 148 mutations/day. Historical story views reuse the same packet and add no separate archive-display reads. These estimates exclude cold-start amplification. Larger archives can hit the payload budget sooner and fail closed. No extra QStash delivery or paid API charge is introduced. Actual account headroom must be checked immediately before production approval is exercised.

## Validation

Focused TypeScript tests cover production opt-in, missing configuration, directory non-activation, exact channel resolution, quota-before-dispatch, persistent restart/recovery using a local store, duplicates, corrections/retractions, CAS conflicts, expiry, transport validation, actual-versus-configured coverage and notification isolation.

Offline fakeredis/Lua simulation executes the transaction for wrong-key rejection, CAS, generation rollback, TTL, concurrent quota claims, failure/no-refund, UTC rollover and write-limit rejection. This is NOT a hosted Redis test. No previous benchmark was repeated. Hosted persistence remains an explicit production-initialization acceptance check, not an already verified claim.

## Exact approved-release procedure (not executed)

1. Owner approves merging PR #26's reviewed release candidate, existing-project production deployment and initialization of the two isolated Pulse keys. Keep PR #19 draft/unmerged.
2. Verify latest PR diff, merge state, current account Redis command/storage/bandwidth headroom, current production flags and deployment protection. Stop if significant regression, insufficient headroom or wrong namespace/configuration is found. Never overwrite existing Pulse archive data during initialization.
3. Preserve all existing production values. Add only FOURTH_DOWN_PULSE_RELEASE=official-feed-v1, FOURTH_DOWN_PULSE_ARCHIVE=isolated-v1, NEXT_PUBLIC_FOURTH_DOWN_NEWS_PILOT=true and NEXT_PUBLIC_FOURTH_DOWN_NEWS_REVIEW=false. Do not copy isolated Preview score/resume flags into production. Leave YouTube configuration and all Pulse push delivery disabled.
4. Merge reviewed PR #26 and deploy using the established workflow. Initial authorized /api/news-pulse request creates the isolated archive through CAS; verify the returned story, exact original link, coverage and source times. Verify a cached repeat and a direct story URL through a new request/controller. Confirm current records, scores, saved favorites and existing notification configuration without sending a test push or changing polling.
5. Check one desktop/mobile smoke, canonical/OG/Twitter metadata, branded image and original destinations. Public social unfurls require a real external crawler after activation; do not claim them confirmed before that check.
6. Confirm isolated-key initialization/readback and low observed resource use. If any critical check fails, disable FOURTH_DOWN_PULSE_RELEASE (and redeploy/rollback using the established workflow); preserve retained archive keys for diagnosis. No deletion of production data. Existing score notifications/favorites/settings remain intact.

Production deployment, public activation and isolated-key writes still require explicit owner approval. YouTube setup can follow separately; no paid service or new scheduler is needed for the limited beta.
