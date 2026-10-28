# Team Resume consumer preview — October 27, 2026

## Working preview

Local-only review: `http://127.0.0.1:3016/`. The default is the genuine October 5–19, 2025 archived replay, with confirmed changes. It is explicitly labeled historical, not today's games. The 2026 saved-update option remains available with its source time and no-live-feed label. No source refresh, deployment or production integration was added.

The preview now follows Fourth Down's production identity: cream / navy / stadium gold tokens, the 4TH wordmark, serif headline accents, existing Lucide navigation icons, light/dark appearances and Stadium Gold / Turf Electric / Prime Time colorways. It includes the production order **Home | Games | Watchlist | Playoff | More** with a fixed five-tab mobile bar and safe-area padding. Non-Playoff links open the existing production destinations; the preview neither recreates settings nor reads/saves preferences.

## Presentation changes

- **Movers & Losers first:** the largest non-tied position changes among the top 35 experimental resumes. Notre Dame is up 28, James Madison up 19 and South Florida up 18; Michigan is down 11, Illinois down 11 and North Texas down 9 in this saved replay. These counts are changes in Resume Ranking, not seeds or playoff likelihoods. Ranking ties without measurable strength changes are excluded from the feature.
- **Plain football explanations:** "Beat NC State, 36–7. Beat USC, 34–24. Published polls also changed." Full result/poll/opponent explanations remain in an expandable evidence section. A team's unchanged place can still show "Held position · new evidence."
- **Compact Team Resumes:** record, conference place with ties kept, experimental Resume Ranking, separate official poll chips, one key strength, one key concern, and a short movement story. Full wins/losses, source context, limitations and remaining games are expandable. Missing opponent evidence is treated as a data limit, not as proof of a weak opponent.
- **Official Polls have their own section:** AP/Coaches/CFP editions retain exact saved places, tie positions, prior-edition movement and publication dates. Resume Ranking is explicitly marked "EXPERIMENTAL · NOT A PLAYOFF SEED." Poll dates render in UTC; capture and game dates explicitly use Eastern time.
- **Useful empty states:** no changes between saved updates; insufficient comparable evidence; and changes outside the featured top-35 window are different cases. An empty feature never silently claims all teams were unchanged when only the featured window is empty.
- **Conditional paths:** no named playoff field, definitive bracket or numerical playoff probabilities. Remaining-game times remain unverified because the ledger does not preserve the needed time-verification flag.
- **Details stay available:** formula, opponent-record assumptions, published-poll weighting, source/input identities, missing evidence and historical replay limitations are retained in How Resume Ranking Works.

The latest saved 2025 AP/Coaches editions are October 12, because the October 19 capture predates that Sunday's poll publication. The 2026 capture uses the October 25 editions. A new date is never invented to make an older edition look current.

## Terminology and historical identities

All current user-facing copy, page metadata, navigation, accessibility labels, tools and documentation use **resume / Resume**. Internal variable names, model versions and historical identifiers are unchanged. The one immutable engine reason string that participates in historical snapshot hashes remains intact inside the canonical engine; it is not a display label or included in the fan-facing payload. Presentation wording is translated outside the frozen snapshot.

Regression checks preserve these actual model identities:

- Before: `9b06086d5c7e159e7cb9a533e64ee23a801b593f0251e67944ce28086786cc31`
- After: `248f99170de47d8e470803b0a9bf7f37109fa5f6cc3a1db5dd393fdb347121a6`

The testing formula remains 35/35/10/20. No ranking, weight, final score, record, qualification rule or source receipt was altered to produce this design.

## Validation

- **307 regression tests pass**, including terminology checks and unchanged historical model identities.
- Lint, type checking and production build pass.
- Chromium, Firefox and desktop WebKit, plus iPhone-sized WebKit: archived result explanations, keyboard activation, current no-change states, search/paging, links, fixed navigation and 320 / 390 / 430 / 1280px layouts.
- Exact UI poll IDs/ranks and publication timestamps are compared with **every row in both saved AP/Coaches editions**, including tied positions. Formatting is checked in a Los Angeles browser time zone.
- Axe checks cover all six appearance/colorway combinations in each browser context; terminology checks also cover rendered text, serialized fan payload and metadata.
- Controlled UI-only simulations test missing records/comparison evidence and movement outside the featured top-35 window. These are not new historical observations.
- Screenshots: `outputs/v086/phase8/overview-chromium-desktop.png`, `overview-webkit-iphone.png`, full-page replay images, and compact Tennessee cards.

No physical iPhone or new push-delivery test is claimed. The earlier intermittent Watchlist WebKit issue remains separate; assertions were not weakened to hide failures.

## Release boundary

PR #19 stays draft and unmerged. No deployment, infrastructure, credential, schedule, subscription or service-plan change was made for this refinement. The prior protected benchmark and production release were not changed. Existing polling and fresh-fetch behavior remain untouched. AP tied-rank notification issue #21 is separate.

This is ready for presentation review. It does not approve public projection activation, a definitive bracket, or a claim of calibrated playoff prediction accuracy. Operational write/retry admission remains a separate gate described in the prior review report.
