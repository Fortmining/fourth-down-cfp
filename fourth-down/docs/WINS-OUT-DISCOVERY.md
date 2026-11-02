# Home discovery and wins-out release candidate

Review found a missing direct What If entry on Home and a four-click Tennessee wins-out path. Added a compact link inside the existing Road to the Twelve panel, plus up to two saved-favorite team shortcuts. No homepage rebuild or full-team list.

A selected team's sandbox now offers **Assume wins out** over its verified, future, non-Final fixtures. It explicitly replaces existing choices only for those games, keeps unrelated picks, and is disabled if the complete operation would exceed16 selections. No partial application. Reapplying is idempotent. Unavailable/expired/duplicate selections are rejected. Unknown fixtures and championship qualification are not assumed. Existing removal, filtering/back preservation and record/evidence calculations remain unchanged.

No URL auto-applies outcomes. Hypothetical choices remain in memory and do not change official results, rankings, saved favorites or alert preferences. No new server endpoint, Redis key, ingestion, credentials, service, schedule or recurring polling. Existing Resume release flag controls Home entry visibility. Branch automatic deployment disabled.

Validation: six focused wins-out/team-discovery tests pass (three new wins-out tests), focused lint and production build/type checks pass. Chromium desktop and iPhone-sized WebKit private captured-data replay pass Home discovery, four Tennessee remaining wins, unrelated-pick retention, repeatability, individual removal, overflow and axe checks. Zero mutation requests/page errors. This is saved-data replay, not observed future outcomes or actual CFP publication. No Preview/production deployment performed.

Existing Rankings, Team Page and Game Center entry links from PR36 remain intact. Rankings-night workflow remains read-only/cutoff guarded. Private PR19 quality-evidence diagnostics are isolated and not imported into this release. No selection forecasts, brackets, seeds, probabilities or qualification claims.
