# Ranked What If? discovery release candidate

Adds an All upcoming / Ranked matchups filter, explicit AP/Coaches/published-CFP source selector, edition dates and ranking labels. CFP is preferred only when actually published; otherwise the chosen poll is named correctly. Missing polls never become a fake CFP edition. Past/Final fixtures cannot become new hypothetical selections.

Game cards link directly to Game Center and both team pages, with an official-poll comparison link. Before/after records are marked confirmed → hypothetical. Competing-team evidence distinguishes opponents this team beat or lost to, and whether their hypothetical winning percentage increases/decreases. This is a transparent record-based explanation, not a selection-model benefit or model-position change. Win percentage can decline even when a selected sequence has more wins than losses; a dedicated regression protects that case.

No new APIs, server reads, Redis keys, ingestion, credentials, schedules, push categories or paid resources. Ranking context comes from the existing live response already fetched by the sandbox. Filters, choices and comparisons remain local memory. Existing single-game scenarios and official poll safeguards are unchanged. Branch automatic deployment disabled; no Preview or production change.

Validation: 18 focused tests across rankings, sandbox arithmetic and discovery; type check, focused lint and production build pass. Chromium desktop / iPhone-sized WebKit pass captured-data ranked discovery (79 games involving ranked teams), AP/Coaches switching, hidden unpublished CFP, direct links, simulated Final removal, overflow and axe checks; zero mutation requests/page errors. These are local replay checks, not newly observed real finals or physical-device evidence. A pre-existing union-type error in a rankings test was fixed with a type-safe property guard; runtime ranking code is unchanged.

Private PR #19 remains separate. No brackets, seeds, probabilities, forecast ranking order or qualification claims. The read-only rankings-night capture/comparison tools remain workspace artifacts; November 3 ingestion is still unobserved.
