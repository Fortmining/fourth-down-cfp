import { resolveConference, type ConferencePolicy } from "./conference.ts";
import { gameProbability } from "./game-prediction.ts";
import { championshipSlots } from "./schedule.ts";
import type { Inputs } from "./types.ts";

type TitleVenue = { kind: "neutral" } | { kind: "home"; teamId: string };

export function simulateConferenceTitle(
  input: Inputs,
  options: {
    fixtureId: string;
    policy: ConferencePolicy;
    conferenceScheduleComplete: boolean;
    simulatedWinners: ReadonlyMap<string, string>;
    ratings: ReadonlyMap<string, number>;
    strengthCoefficient: number;
    homeCoefficient: number;
    verifiedVenue: TitleVenue | null;
    draw: number;
    bigTenBoundaryDraw?: number;
    scenarioTiebreakDraw?: number;
    eligibleWins?: Record<string, number>;
  },
) {
  const withheld = (issues: string[]) => ({
    status: "withheld" as const, issues, fixtureId: options.fixtureId,
  });
  const slot = championshipSlots[options.fixtureId];
  const fixture = input.pendingGames?.find(game => game.id === options.fixtureId);
  const asOf = Date.parse(input.observedAt);
  if (input.season !== 2026 || !slot || !fixture ||
      !(Date.parse(fixture.observedAt) <= asOf) || !(Date.parse(fixture.date) > asOf)) {
    return withheld(["No verified future conference championship slot"]);
  }

  const qualification = resolveConference(input, slot.conference, options.policy, {
    regularSeasonComplete: options.conferenceScheduleComplete,
    simulatedWinners: options.simulatedWinners,
    bigTenBoundaryDraw: options.bigTenBoundaryDraw,
    eligibleWins: options.eligibleWins,
    scenarioFallback: options.scenarioTiebreakDraw === undefined ? undefined :
      { ratings: options.ratings, draw: options.scenarioTiebreakDraw },
  });
  if (qualification.participants.length !== 2) return withheld(qualification.issues);
  const [first, second] = qualification.participants;
  const a = options.ratings.get(first);
  const b = options.ratings.get(second);
  const venue = options.verifiedVenue;
  if (!venue || (venue.kind === "home" && !qualification.participants.includes(venue.teamId))) {
    return withheld(["Championship venue is unresolved"]);
  }
  if (a === undefined || b === undefined ||
      ![a, b, options.strengthCoefficient, options.homeCoefficient, options.draw].every(Number.isFinite) ||
      options.draw < 0 || options.draw >= 1) {
    return withheld(["Championship game model inputs are invalid"]);
  }
  const homeEffect = venue.kind === "neutral" ? 0 :
    (venue.teamId === first ? 1 : -1) * options.homeCoefficient;
  const probability = gameProbability(a - b, options.strengthCoefficient, homeEffect);
  return {
    status: "simulated" as const,
    hypothetical: true as const,
    fixtureId: fixture.id,
    conference: slot.conference,
    participants: [first, second] as const,
    winner: options.draw < probability ? first : second,
  };
}
