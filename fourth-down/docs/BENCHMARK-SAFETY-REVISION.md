# Protected benchmark safety revision

This supersedes the 400-snapshot workload in 075ed6a. No hosted run or deployment has taken place.

## Hard bounds

- 400 total mutating Redis command attempts, including script commands, setup, retries, eviction and cleanup. Reserve worst-case cost before every dispatch; ambiguous errors do not refund reservations.
- Twelve snapshot operations; eight retained pairs so eviction is exercised. Each Lua attempt reserves eleven mutations (eight base plus three eviction commands). At most two attempts after a transport failure, plus three controlled response-loss reissues. Worst-case total is `(12 × 2 + 3) × 11 + 8 = 305` mutations. Six cleanup EXPIRE mutations are reserved before setup. No cleanup retry. One setup SET and one cache SET account for the other two.
- At most 400 cached-display GET attempts; count before dispatch, including failed attempts. Other reads (head/CAS, storage/TTL, script reads) are separate and reported; they are not silently categorized as cache reads.
- Lua reports its successful internal read and mutating-command counts. If a response is lost, actual completed effects are unknown; preserve the full eleven-mutation upper bound and report ambiguity rather than inventing an exact invoice count.
- No pipeline, timer, scheduler or deferred work. Concurrent visitors settle before failure cleanup. Every bounded transport has a five-second timeout.
- Atomic once marker prevents concurrent duplicate runs in the one deployment. Ambiguous marker creation is not retried. Expiring data and temporary credential revocation prevent later reuse; do not delete the once marker to rerun.

## Isolation

Benchmark transport now accepts only dedicated FOURTH_DOWN_BENCHMARK_REDIS_URL/TOKEN, with an explicit isolation-verification gate. It never falls back to production KV/UPSTASH credentials. Before enabling it, verify either a dedicated database or a temporary key/command-restricted ACL, including denied access to production keys. Existing credentials are not changed. Do not give the Preview production CRON, VAPID, QStash or other integration credentials.

All data commands are constrained to seven benchmark keys. Lua declares precisely its five namespaced keys. No production application/notification key, scan, flush or delete command is allowed. The temporary user must have only the commands needed for the seven keys, not administrative or notification access. Credential creation through the browser requires action-time confirmation under the browser tool's security-access policy; no secret should be shown in chat or committed.

## Tests and limits of evidence

Local simulations cover successful retries, post-commit response loss, repeated deployment rejection, partial script failures, cleanup failure, stale budget rejection, environment/origin gates, and no in-flight work after failure. They do not establish hosted Redis cost, memory, CPU, ACL enforcement or automatic production update reliability.

The twelve-pair workload uses captured verified inputs with varying benchmark metadata; it measures bounded retention mechanics, not new live source events. Full 384-pair retention is intentionally not claimed. The public automatic source-update → history → cached-display path remains unimplemented/unverified and is a release blocker.

Current recommendation: NO-GO for public activation. The single protected Preview deployment remains unused until isolation and strict safety are demonstrated. No service upgrade, production configuration change, polling change, public feature activation or merge is authorized.
