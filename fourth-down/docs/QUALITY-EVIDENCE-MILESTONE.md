# Private quality-win / bad-loss evidence milestone

Introduced a diagnostic evidence module, **not a new selection model**. It retains each confirmed game ID/date/source and the opponent's captured overall record excluding every head-to-head game against the evaluated team. Fixed exploratory flags: win against an opponent with >=75% wins; loss against an opponent with <=25% wins; at least six other games required. Unknown opponents, small samples and record conflicts remain unavailable; incomplete season coverage withholds counts. Zero flags with unavailable observations must not be interpreted as proof that no quality win or bad loss exists.

Unlike the old R component, this outcome/strength interaction distinguishes equal win percentages and equal mean opponent strength: beating the strong opponent/losing to the weak one produces different evidence from the reverse assignment. A focused counterexample test establishes this independence; it does not establish predictive value. The thresholds are private diagnostic cutoffs, not committee policy. Raw opponent win rate is not schedule-adjusted opponent strength or calibrated strength of record.

Replayed only the latest genuine complete, vintage-verified cutoffs:
- 2024 Dec7: 134 teams, 77 strong-record-win flags, 35 weak-record-loss flags, 121 unavailable opponent observations.
- 2025 Dec6: 136 teams, 70/29 flags, 126 unavailable observations.

No weights, ordering, qualification allocator or multi-game scenario code were changed. Qualification must stay separate from committee ordering; these counts do not resolve conference champions, eligibility or automatic bids. Previously inspected 2024/2025 seasons remain development evidence. Prospective protocol requires feature/forecast capture before publication and comparison against separately captured committee outcomes. There is no new selection-accuracy, bracket or probability claim.

Three focused tests pass: outcome-strength independence/source immutability, missing/small/conflicting/incomplete data, future-observation rejection. Reproduce `node --experimental-strip-types scripts/audit-quality-evidence.mjs`; output workspace outputs/selection-validation-nov2/quality-evidence.json retains source/input hashes. No external requests, production writes, notifications, credentials, schedules or service changes.
