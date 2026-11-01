# Game Center MVP — development candidate

Scope: reusable ESPN summary adapter and game-page viewer for all game IDs, with source team logos/scores, venue and neutral designation, offense-relative field position, reported yardage, first-down marker, source play text, drive history and team/player box scores. Historical play selection is explicit. Endpoints are schematic and never represented as tracked ball flight.

No actual stadium artwork has been added: source/rights approval is absent. Neutral-site games never inherit the designated home team's turf. Generic turf is explicitly labeled. Unknown/missing coordinates never default to zero or midfield. Penalties, possession changes, kicks and administrative plays withhold animation. Current overlapping drive copies replace older copies. No lateral or aerial trajectory is fabricated.

Data flow: game page -> existing /api/games/[id] -> existing cached ESPN summary -> bounded adapter -> field/box scores. The endpoint still validates game identity and 2026 season; notification fresh-fetch code is untouched. An open game page adds at most one summary request per minute plus existing focus/reconnect refresh triggers, guarded against concurrent requests. Source cache and CDN retain their existing 60-second settings; provider delays are possible. No Redis, schedule, subscription or credentials change.

Validation: eight adapter cases; existing resume-refresh test; 64 targeted CFP record/ranking/resume tests; production build and targeted lint. Browser tests use a real captured Florida–Georgia summary (22 drives, 163 plays, 122 traceable): desktop Chromium and iPhone-sized WebKit, source logos, neutral venue, field, box scores, no horizontal page overflow and focused accessibility. The first mobile pass found an unfocusable scrolling player-stat region, now corrected. These are replay/layout tests, not real-time play synchronization or a physical-device animation test.

Release exclusions / next checks: actual licensed home/neutral venue art; live new-play/focus demonstration on a real game; physical iPhone review. No production merge or release authorized. No brackets or numerical probabilities enabled. PR #19 and Pulse implementation are separate.

## November 1 private follow-up

Rebased onto released main including CFP cutoff PR #29 and Pulse PR #26. The single DetailPage conflict retains the Pulse review notice, score-refresh hook and Game Center. Home branding uses the provider's explicit non-neutral designation, unique home team, validated six-digit color and ESPN-hosted team logo, with an explicit schematic label. Neutral or unknown-site games do not inherit home branding. No licensed stadium field designs have been acquired or invented. Reported yardage conflicting with endpoint distance suppresses the tracer; reduced-motion users receive a static endpoint marker.

Fourteen focused adapter/refresh tests pass, including neutral/unknown branding, unsafe asset rejection, conflicting yardage and negative gains. Under the owner’s updated release-first direction, real-game and physical-iPhone checks remain follow-up observations, not sole launch blockers. Automated simulations remain explicitly labeled. No production deployment, new infrastructure or asset rights claimed.

Current release gates and deployment/rollback scope: GAME-CENTER-RELEASE.md.
