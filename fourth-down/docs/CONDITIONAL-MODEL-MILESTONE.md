# Private conditional model milestone

The existing frozen resume model and seven candidate weight configurations are retained. The new conditional-resume module evaluates a separate hypothetical outcome graph, never fabricating a score or writing a final into the confirmed ledger. Official poll components remain unchanged. All teams are recalculated, including third-party opponent-quality effects. Numerical ties are expressed as position bands, not playoff seeds or probabilities.

Seven focused tests pass, including exact confirmed-score parity across all configurations, source immutability, indirect team effects, missing/conflicting/future evidence rejection, premature CFP rejection, and both outcomes across seven models on genuine archived October 5, 2025 as-of inputs (136 teams). This is retrospective counterfactual validation, not historical forecast accuracy. Focused lint and strict type checking of the new module and its dependencies pass using the shared installed tooling.

Existing selection benchmarks do not establish superiority to published-poll baselines. Conference eligibility/tiebreaker evidence and championship forecasting remain unresolved dependencies for a definitive field. The current Big Ten 2026 official championship page confirms top-two conference records but does not supply a complete 2026 tie cascade. No field, probability, new public route, model activation, schedule, credential or production change is introduced.

Next: validate conditional effects against additional genuine as-of windows and separate conference qualification evidence before any public projection release. PR #30 remains an independently releasable record-arithmetic feature.
