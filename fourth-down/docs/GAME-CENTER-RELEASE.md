# Game Center controlled release candidate

Scope: game pages only. Team logos/scores, source-confirmed home colors/logo on a clearly labeled schematic, neutral/unknown generic fields, animated verified play endpoints, SVG gain/loss tracers, first-down target, down/distance and possession, play-by-play, drive history and player/team box scores. Replay browsing has an explicit return-to-latest control. Source check time is separate from source publication; no instantaneous delivery claim.

Live situation comes from the supplied situation object. If absent, a usable latest play end may be shown only as “After the last reported play”, never as an extra live observation. Finals do not display an old down as current. Missing/conflicting/penalty/turnover/administrative positions do not animate. No tracked ball flight or actual stadium-design claim. Reduced-motion users receive a static marker.

Operating behavior: reuse the existing cached game-summary endpoint and ESPN adapter. An open, visible game page reads summary at the existing one-minute client refresh cadence and on resume/focus/reconnect, with no overlapping request in that component. No background job, new notification cadence, Redis keys, credentials, paid services or ESPN score-ingestion changes. An unavailable play feed leaves existing live scores and earlier play details usable with a warning. Responses must match the requested game; old-game requests are aborted on navigation.

Essential gates: focused Game Center/refresh/team-detail tests, changed-file lint, production build (includes type checking), and a consolidated browser simulation/replay covering updates, replay/follow latest, failures, mobile layout and accessibility. Previously verified score-alert code remains unchanged. Do not repeat unrelated full suites.

Physical iPhone and new real-game observation are follow-up verification, NOT launch blockers under the owner's updated release-first direction. Exact stadium artwork is also excluded from blockers: only provider-derived schematic branding ships until verified designs/rights exist.

Approval requested: merge the reviewed PR #28 head and deploy through the existing Vercel Git production workflow. No environment changes or namespace initialization needed. Post-release: verify exact production SHA/worker bytes, representative game pages and source API responses, scores and saved local preferences; inspect notification health once as a release check, without test pushes. Stop/rollback if a critical regression appears. Rollback target is the current healthy Pulse deployment dpl_nEegcHyVsWWQe8ezE7s4jHqqUKRT (ef54f96); no rollback executed.

Follow-up: observe the next genuinely live college game and review the installed iPhone PWA. Preserve remaining alert-category verification as separate work. Pulse expansion and CFP what-if features do not gate this release and are not bundled here.
