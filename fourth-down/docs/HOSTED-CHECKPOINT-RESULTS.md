# Hosted checkpoint test — failed closed, cleanup complete

The single approved supervised test was attempted against hosted Redis. **It did not pass.** No model snapshot was created. The ten-minute work window was not reset or extended, and no second hosted run was started.

Fresh admission showed one Redis database, approximately 61K/500K commands, 31MB/250MB storage and 933MB/10GB bandwidth, at $0.00. The temporary ACL allowed exactly the four approved keys and only EVAL, GET, SET, EXISTS, EXPIRE and TTL. In-scope TTL reads proved valid access to four absent keys. Direct and scripted access to a separate absent out-of-scope canary was denied; no production application key was probed.

The first freshness operation raised `attempt to index a non-table object(nil) with key 'protocol'`. One charged diagnostic reproduced it: hosted `cjson.decode` accepted an empty string with a nil result, so pcall success did not imply a table. Offline code now type-checks every decoded checkpoint/quota/head before indexing it. This correction has not been retested on hosted Redis.

## Recorded outcome

- Durable whole-run reservations: **45 commands, 18 conservative write charges, 28 reads, 32 external attempts, 157,092 body bytes reserved**. These include setup, the failed work, one diagnostic recovery, both cleanup passes, ACL disable and rejection verification. Automatic transport retries: zero.
- Failing Lua returned no instrumentation receipt. Exact provider-billed nested counts are unavailable; reservations are upper bounds, not actual invoice counts. They remain far below the approved 2,400/900/1,200 limits.
- No automatic model update, retained-history, duplicate-recovery or cached-display success is claimed from this hosted run. Those remain offline-tested only.
- All four keys were verified absent with TTL -2. Temporary access was disabled and the REST credential explicitly rejected. Three local credential/endpoint files were removed and browser credential buffers cleared. The disabled ACL record remains for audit; existing users were unchanged.
- The diagnostic/cleanup/revocation sample of 14 requests had median **59.9ms**, p95 **319.7ms**. First-controller timings were not retained. This is not snapshot-update latency or Vercel CPU.
- Final dashboard: about **61K/500K commands, 31MB/250MB storage, 935MB/10GB bandwidth, $0.00**. Rounded account values include ongoing production activity and cannot isolate this test's small usage. Physical Redis memory was not measured; the test keys were absent after cleanup.
- No production deployment, public feature activation, polling change, existing credential change, subscription/preference mutation or service upgrade occurred. Production notification delivery was not retested or inferred from these results.

**Decision:** NO-GO for the hosted persistence milestone or public activation. GO for continued current-season feature development using the private file-backed producer and preview. A further hosted retest requires new explicit approval; none is assumed.

Detailed secret-free admission, isolation, journal, diagnostic, cleanup/rejection, headroom and screenshot evidence is retained in private `outputs/v086/phase14/hosted/` artifacts.

## Fan-facing work continued

The private 2026 Resume Center now lives inside the existing Next app at `/private/resumes`, using Fourth Down's appearance, five-tab navigation, existing follow dialog and direct team/game links. It shows compact resume evidence, up to three rises and three falls, official poll movement separately, remaining tests, honest empty/stale states and no bracket/probabilities. It is development-only and returns 404 in production even if its preview flag is mistakenly enabled.

The new current-season producer consumes already-captured sources, carries confirmed results across disappearing feeds and restarts, ignores older observations, reconciles all teams and preserves history. It has no source-fetch transport or production schedule. The display reads only its private file store. Optional file watching publishes incoming captures; no new production polling was installed.

Three one-time no-store ESPN requests supplied current scoreboard/rankings and the next provider-calendar schedule capture. The first independent input was unchanged. The schedule metadata update retained a second confirmed snapshot without inventing game-result movement. Saved confirmed updates can be selected with their original timestamps; they are explicitly not live source checks. Old captures are not retimestamped to keep the preview looking live; movement is withheld after source verification expires.

Local startup:

```sh
RESUME_CURRENT_SEED=/private/verified-2026-inputs.json RESUME_CURRENT_CAPTURE=/private/captured-source.json RESUME_CURRENT_STORE=/private/current-resume RESUME_CURRENT_WATCH=true node --experimental-strip-types scripts/ingest-current-resume.mjs
FOURTH_DOWN_PRIVATE_RESUME_PREVIEW=true FOURTH_DOWN_PRIVATE_RESUME_STORE=/private/current-resume FOURTH_DOWN_PRIVATE_RESUME_CAPTURE=/private/captured-source.json npm run dev -- --hostname 127.0.0.1 --port 3020
```

Captured sources must supply actual source timestamps and no-store verification. This is a working development integration, not a claim that the production dispatcher or distributed cache is connected.
