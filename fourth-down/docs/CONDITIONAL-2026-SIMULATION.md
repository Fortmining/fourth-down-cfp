# November 4 conditional playoff simulation

The private replay uses the reconciled November 4 ESPN capture and the fitted
pregame model. Ordinary FBS teams enter under a working presumption of
eligibility absent a documented restriction. This is a model assumption. It
does not certify membership compliance or override an observed sanction.
Institutional evidence retains priority through the existing resolver.

- The NCAA adopted proposal 2026-31 on June 24. Reclassifying teams can
  participate subject to the rule's compliance requirements.
  https://web3.ncaa.org/lsdbi/search/proposalView?id=109240
- Sacramento State and North Dakota State are tested both included and
  excluded. Sacramento State's February transition guidance predates the new
  NCAA rule, and North Dakota State's bowl announcement does not separately
  settle conference or CFP participation.
  https://web3.ncaa.org/directory/orgDetail?id=102
  https://gobison.com/news/2026/10/17/bison-bowl-eligible-after-beating-nevada-31-17
- Delaware and Missouri State announced 2026 conference championship and bowl
  eligibility. Akron announced that its prior postseason ban was lifted.
  https://bluehens.com/news/2023/11/28/delaware-athletics-delaware-accepts-invitation-to-join-conference-usa-as-full-member
  https://missouristatebears.com/news/2024/5/10/general-missouri-state-accepts-invitation-to-join-conference-usa
  https://gozips.com/news/2026/3/4/akron-football-bowl-eligible-for-2026-practice-restrictions-lifted

The Pac-12 published provisional opponents and named the four hosts. The
alternate swaps the Boise State and Texas State destinations while preserving
those hosts. It is a sensitivity case rather than a league-approved schedule.
All four flex games enter overall records and do not enter conference records.
https://pac-12.com/news/2026/5/26/pac-12s-2026-football-broadcast-schedule-and-kickoff-times-announced.aspx

Use `node --experimental-strip-types scripts/simulate-2026-conditional.mjs
<CAPTURE_DIRECTORY> <GAME_MODEL_JSON> <published|swap> <exclude|include>`.
Each run has 50,000 trials with seed 2026. Title draws use an independent
deterministic stream keyed by trial and championship slot. Confirmed data is
left intact. The four Power Four slots use the neutral sites verified in the
capture. The remaining six title results are outside the current model.

The AP baseline preserves existing published rank order, with simulated
records used for unranked teams and poll ties. It is a field-allocation
reference, not a model of the committee's response to hypothetical results.
Unresolved decisive tiebreakers remain in the total trial denominator, and
their reasons can overlap. A resolved example is a conditional illustration.
It cannot establish calibrated team odds or a projected bracket.
