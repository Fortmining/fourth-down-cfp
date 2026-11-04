import fs from "node:fs";
import path from "node:path";
import { applyEligibility } from "../app/lib/playoff/eligibility.ts";
import { gameProbability, gameStrengths } from "../app/lib/playoff/game-prediction.ts";
import { runPlayoffBatch } from "../app/lib/playoff/playoff-trial.ts";
import { scheduleAudit } from "../app/lib/playoff/schedule.ts";

const [source, modelFile] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(path.join(source, "inputs.json")));
const models = JSON.parse(fs.readFileSync(modelFile)).models;
const model = models.colleyVenue;
const cross = models.crossSubdivision;
if (input.season !== 2026 || !Number.isFinite(model?.strength) || !Number.isFinite(model?.home))
  throw new Error("Require a 2026 capture and fitted venue model");

const eligibility = applyEligibility(input.teams, JSON.parse(fs.readFileSync(
  new URL("./data/eligibility-scope-evidence-2026.json", import.meta.url),
)), input.season, input.observedAt);
const schedule = scheduleAudit(input);
const cutoff = Date.parse(input.observedAt);
const { colley } = gameStrengths(input);
const venues = new Map();
for (const file of fs.readdirSync(source).filter(name => /^week-\d+\.json$/.test(name))) {
  const packet = JSON.parse(fs.readFileSync(path.join(source, file)));
  for (const event of packet.events ?? []) {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find(team => team.homeAway === "home");
    const away = competition?.competitors?.find(team => team.homeAway === "away");
    if (home && away && typeof competition.neutralSite === "boolean")
      venues.set(String(event.id), { home: String(home.team?.id), away: String(away.team?.id), neutral: competition.neutralSite });
  }
}
const missing = { venue: [], modelTeam: [], unresolvedGameState: [] };
const remaining = input.games.filter(game => !game.completed);
const fixtures = remaining.flatMap(game => {
  const [a, b] = game.teams;
  if (game.state !== "pre" || !(Date.parse(game.date) > cutoff)) {
    missing.unresolvedGameState.push(game.id);
    return [];
  }
  if (colley.has(a) !== colley.has(b) && Number.isFinite(cross?.fbsWinProbability)) {
    return [{ id: game.id, teams: game.teams, firstTeamWinProbability: colley.has(a)
      ? cross.fbsWinProbability : 1 - cross.fbsWinProbability, model: "pooled-cross-subdivision" }];
  }
  if (!colley.has(a) || !colley.has(b)) {
    missing.modelTeam.push(game.id);
    return [];
  }
  const venue = venues.get(game.id);
  if (!venue || ![a, b].includes(venue.home) || ![a, b].includes(venue.away) || venue.home === venue.away) {
    missing.venue.push(game.id);
    return [];
  }
  const offset = venue.neutral ? 0 : venue.home === a ? model.home : -model.home;
  return [{ id: game.id, teams: game.teams, firstTeamWinProbability: gameProbability(colley.get(a) - colley.get(b), model.strength, offset) }];
});
const issues = [...eligibility.issues];
if (!input.coverage.complete) issues.push("Confirmed schedule or records do not reconcile");
if (eligibility.unresolved.length) issues.push("Institutional eligibility unresolved");
if (schedule.pending.some(row => row.kind === "flex-slot")) issues.push("Pac-12 regular-season flex opponents unassigned");
if (schedule.unclassified) issues.push("Unclassified schedule slots");
for (const [key, games] of Object.entries(missing)) {
  if (games.length) issues.push(`Remaining game inputs missing: ${key}`);
}
if (!issues.length) throw new Error("Use a configured selection and championship model for admissible full runs");
const seed = 2026;
const result = runPlayoffBatch(fixtures, { trials: 50_000, seed }, () => ({ status: "withheld", issues }));
console.log(JSON.stringify({
  scope: "Seeded real-schedule coverage audit. Global input failures preclude title and field allocation in every trial.",
  asOf: input.observedAt,
  season: input.season,
  seed,
  teams: input.teams.length,
  completedGames: input.games.length - remaining.length,
  namedRemaining: remaining.length,
  sampledFixtures: fixtures.length,
  pooledCrossSubdivisionFixtures: fixtures.filter(game => game.model === "pooled-cross-subdivision").length,
  missing,
  eligibility: { verified: input.teams.length - eligibility.unresolved.length, unresolved: eligibility.unresolved },
  pendingSlots: schedule.pending,
  result,
}, null, 2));
