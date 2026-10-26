import type { EligibilityEvidence } from "../lib/playoff/eligibility.ts";
// Institutional eligibility, not a claim that a team has clinched a bowl/CFP berth.
// FAQ revision date is unavailable; only the actual research observation is used.
export const eligibilityEvidence2026: EligibilityEvidence[] = [
  {
    id: "2006",
    season: 2026,
    status: "eligible",
    scope: "institutional",
    source:
      "https://gozips.com/news/2026/3/4/akron-football-bowl-eligible-for-2026-practice-restrictions-lifted",
    publishedAt: "2026-03-04T00:00:00Z",
    observedAt: "2026-10-25T18:27:30.663952+00:00",
    reason:
      "University reports NCAA waiver restoring 2026 postseason and MAC championship eligibility; low APR alone must not recreate the lifted ban.",
  },
  {
    id: "2449",
    season: 2026,
    status: "eligible",
    source:
      "https://gobison.com/sports/2026/2/9/fbs-frequently-asked-questions",
    publishedAt: null,
    observedAt: "2026-10-25T17:47:38.242539Z",
    reason:
      "NDSU explicitly confirms immediate 2026 MW Championship, CFP and bowl eligibility following the NCAA June rule change.",
  },
];
