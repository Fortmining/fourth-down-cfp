# What does this result mean?

Focused release candidate: rich single-game explanations over the existing confirmed snapshot, not the private PR19 model. The reusable multi-game catalog keeps the original arithmetic-only adapter; explanations are computed only by the one-game response, without extra upstream requests.

Tennessee–Kentucky genuine November2 capture: Tennessee6–2/3–2 SEC, Kentucky7–1/5–1. A Tennessee win makes both7–2 overall and leaves both on two conference losses (Tennessee4–2, Kentucky5–2). A Tennessee loss makes Tennessee6–3/3–3 and Kentucky8–1/6–1, a three-versus-one loss comparison. This is not an official standings tie or resolved championship tiebreaker. Kentucky's AP8/Coaches7 context is labeled by the captured edition, not predicted game-day or year-end rank.

The cards explain ranked-opponent evidence, conference losses/head-to-head, connected teams supported by reciprocal confirmed game IDs, and next reciprocal scheduled games. Existing ranked-opponent results stay in a secondary disclosure. Future/missing CFP context is excluded. Unknown standings, eligibility, championship qualification and selection consequences remain explicit. No inferred elimination, berth, seed, bracket, probability or committee endorsement.

Snapshot hashes, methodology and limits remain expandable. Winner-first cards, current records, next-game links and team-specific Opponent Watch are the primary flow. Reconciliation retry, duplicate-request protection and Final-game hiding remain intact.

Validation:12 existing one-game tests and3 new explanation tests pass. Focused lint/type checks pass. Chromium and iPhone-sized WebKit replay using the genuine138-team November2 public snapshot passes both outcomes, retry protection, Game Center retention, Final hiding and zero axe violations/overflow/API writes/page errors. Screenshots/results are workspace outputs/scenario-outcome-explanations. A duplicate navigation-landmark label was fixed during testing. No production/PWA, notification, schedule, preference, credential or private-engine changes. Branch auto-deploy disabled.
