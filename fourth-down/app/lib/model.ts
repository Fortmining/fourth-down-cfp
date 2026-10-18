export type Ranked = {
  rank: number;
  previous: number | null;
  teamId: string;
  name: string;
  logo?: string;
  record: string;
  conference: string;
};
export const tiers = [
  {
    name: "Leading the race",
    range: "Ranks 1–4",
    min: 1,
    max: 4,
    tone: "mint",
    reason:
      "A top-four poll position is a strong starting point, but a bye must be earned in the final CFP rankings.",
  },
  {
    name: "In the conversation",
    range: "Ranks 5–12",
    min: 5,
    max: 12,
    tone: "blue",
    reason:
      "Inside the poll’s top 12. Automatic qualifiers can move the actual selection cut line.",
  },
  {
    name: "On the bubble",
    range: "Ranks 13–18",
    min: 13,
    max: 18,
    tone: "gold",
    reason:
      "Just outside the poll’s top 12. Results ahead and the automatic bids can change the path.",
  },
  {
    name: "Chasing the field",
    range: "Ranks 19–25",
    min: 19,
    max: 25,
    tone: "rose",
    reason:
      "More ground to make up in the poll. A conference title path can still matter; this is not elimination.",
  },
];
export function tierFor(rank: number) {
  return tiers.find((t) => rank >= t.min && rank <= t.max)!;
}
export function movement(t: Ranked) {
  return t.previous && t.previous <= 25 ? t.previous - t.rank : null;
}
// A poll-only illustration, deliberately not an automatic-bid or selection forecast.
export const matchups = [
  { host: 8, away: 9, bye: 1 },
  { host: 5, away: 12, bye: 4 },
  { host: 7, away: 10, bye: 2 },
  { host: 6, away: 11, bye: 3 },
];
