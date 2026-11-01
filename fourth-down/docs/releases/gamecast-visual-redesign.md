# Game Center visual redesign

Scope: presentation over the existing Game Center adapter, replay history, statistics and minute/resume refresh transport. No score, notification, preference, scheduler, CFP, Pulse or Redis changes.

- Broadcast header combines source-provided logos, scores, status/clock, possession and down/distance. Parent scoreboard remains the fallback when play details cannot load.
- Perspective SVG field uses verified home colors/logo; neutral and unknown sites retain generic branding. Straight animated tracers use only adapter-verified start/end spots. No player tracking or ball-flight claims. Reduced-motion mode shows a static football.
- Plays, Drives, Team Stats and Players tabs replace long nested disclosures. Selected play text appears once, with keyboard replay selection and a return-to-latest control.
- Source freshness, field-artwork limits and provider link are in a keyboard-accessible information disclosure.
- Page-specific styling removes inherited homepage hero spacing. Display options and Follow Game remain available.
- Branch automatic Vercel deployment disabled; no Preview or production deployment authorized/performed.

## Verification

28 existing focused adapter, refresh and team-data tests passed. Type check and changed-component lint passed. Browser check uses a saved normalized ESPN Tennessee–South Carolina final capture; transport transitions and failure/neutral/missing states are explicit offline simulations, not a new live-game or physical-device verification.

Reproducible check: set GAMECAST_CAPTURE to the saved normalized API response and TEST_URL to the local server, then run `node scripts/gamecast-visual-check.mjs`. All /api requests are intercepted; mutation requests are rejected. Covers replay, current-source updates, retained snapshot on failure, scoreboard fallback on initial detail failure, missing data, neutral branding, keyboard tabs, reduced motion, 320px overflow and Gamecast accessibility.

Public activation requires owner approval of this separate PR. PR #19 and game-scenario PR #30 are outside scope.

Final production build and changed-component lint passed. Consolidated Chromium desktop and WebKit iPhone-sized checks passed on the production build: zero Gamecast axe findings, page errors or API mutation requests; no 320px page overflow. Initial play-feed failure also preserves the parent scoreboard. Screenshots and machine-readable results are saved in the workspace outputs/gamecast-redesign directory. The initial local dev/build folder collision was resolved by stopping dev and verifying a clean production build; it was not an application or production failure.
