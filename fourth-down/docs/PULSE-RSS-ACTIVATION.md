# Three-feed headline activation candidate — November 3, 2026

Owner directed activation of the existing ESPN NCF, NCAA FBS and NCAA FCS adapters. This change records owner authorization separately from publisher-granted sources; it does not fabricate publisher permission or endorsement. No additional source research or reader rebuild.

Release configuration, subject to final production approval: NEXT_PUBLIC_FOURTH_DOWN_PULSE_RSS=headlines-v1 (build-time public switch). Existing official-feed-v1/isolated-v1 Pulse configuration remains unchanged. No new credentials, keys, schedules, notifications or paid services. No public activation performed during preparation. Branch auto-deployment disabled.

All three feeds retain exact headline, publisher, original publication date and validated original article/video URL. No copied summaries, images or article bodies. Publisher analysis remains distinct from official rankings and Fourth Down scenarios. National/FBS/FCS views and favorite/follow matching reuse PR40, with explicitly labeled national fallback when no Tennessee headline matches.

Shared provider refresh: ESPN30min, NCAA FBS15min, NCAA FCS60min. Existing timeout5sec,256KiB/source, no redirect/retry, concurrency2. Production fanout remains8 adapters including curated capture; redundant KFF adapter is excluded while sports RSS is active. Additional168 fetches/day per cache filler, not a global exact cap. At current sizes approximately3.13MB/day. Cache-region amplification/billed CPU remain unmeasured. Existing200item/512KiB archive, two keys and write meter remain unchanged; capacity is not guaranteed180day retention.

Rollback: remove the switch and rebuild/redeploy, or restore previous deployment. Any unrecognized archive items fail closed; a rollback may temporarily withhold Pulse archive content rather than leak disabled-source data. Scores/notifications use separate paths and are unaffected. No production rollback executed during preparation.

Validation artifacts: /Users/rick/Documents/ChatGPT/Fourth Down/outputs/pulse-rss-activation. Final approval is required to merge/deploy and set the release switch.
