# CFP publication guard and What If journey

Release scope: withhold invalid CFP editions and make the selected-team scenario easier to follow. No prediction model, notification worker, schedule, credentials or production data changes.

## Publication contract

The shared live-feed collector (used by Rankings, Home, Team Pages and What If) requires a dated current-season CFP edition containing exactly25 unique teams in unique integer positions1–25. Missing, future, invalid and pre-November3 2026 edition dates are withheld. A newer partial edition cannot displace a prior valid edition. AP/Coaches ties and their source identification are unchanged. The November3,7PM Eastern time boundary remains in force; reaching that time alone never establishes publication.

The calendar-date floor allows provider date-only/midnight edition metadata; it does not claim that metadata establishes actual first publication time. Independently compare all25 identities/positions to the committee announcement after publication. A complete source-attributed provider edition is not itself proof of committee accuracy.

Official schedule rechecked November2: https://collegefootballplayoff.com/news/2026/8/6/sc-aug-2627 lists November3,7–8PM ET. Existing bounded read-only capture workflow is in workspace outputs/cfp-nov3-readiness: max27 sequential requests, no retries,16MB total; no credentials or writes. No new monitor/schedule is added. Actual publication remains unobserved.

## Fan journey

Home/Rankings/Team Pages/Game Center entries remain in place. After Assume Wins Out, an explicit opponent-watch action clears discovery filters, retains every hypothetical selection and scrolls to the available games. Opponent Watch reports the number matching the current filters. The chosen team's before/after record appears first among affected teams; the remaining comparisons retain their existing order. No opponent evidence is called a selection benefit. Championship qualification is never assumed.

## Private model boundary

Private PR19 remains separate. Existing quality evidence uses confirmed outcome/opponent links and excludes head-to-head from opponent records. Exploratory75%/25% flags are not committee rules, independent calibrated strength or a validated forecast. Do not retune the redundant record/schedule components or mix qualification allocation into ordering. The prospective protocol must save/hash inputs, frozen model order and poll baseline before reading the target; report Top25 overlap and rank error separately from final12-team selection. The existing validation lock has no captured forecast yet. The October26 archived2026 research input is stale and must not be represented as a current November2 forecast. No new selection improvement is claimed.

## Operating impact

No new endpoint, external fetch, Redis command, polling, credentials, infrastructure or service plan. Complete-edition validation is bounded to25 rows; UI changes reuse the loaded catalog. Branch auto-deploy disabled. No protected Preview or production deployment is authorized by this development milestone.

## Milestone validation

21 focused rankings/discovery/wins-out/recovery tests pass. Chromium desktop and iPhone13 WebKit captured-data replay passes Home entry, four Tennessee wins, unrelated selection preservation, idempotence/removal, chosen-team-first comparison, opponent-watch shortcut, Game Center link identity and synthetic post-publication CFP default/manual-source preservation. Zero axe violations, overflow, API writes or page errors. This is offline replay, not actual CFP publication. Screenshots/results are in workspace outputs/cfp-context-journey.

Two bounded public GETs on November2 captured current live/poll and resume packets, hashes, snapshot cutoff/model version, descriptive resume order and AP baseline into outputs/cfp-nov3-readiness/prospective-nov2. No credential, schedule, Redis write or model change. The frozen comparison inputs retain archived status/freshness; they do not complete the private model's independent prospective forecast requirement.
