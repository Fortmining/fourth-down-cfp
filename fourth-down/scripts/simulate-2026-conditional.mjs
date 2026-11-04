import fs from "node:fs";
import path from "node:path";
import { applyEligibility } from "../app/lib/playoff/eligibility.ts";
import { currentRecords } from "../app/lib/playoff/ledger.ts";
import { gameProbability, gameStrengths } from "../app/lib/playoff/game-prediction.ts";
import { resolvePlayoffTrial, runPlayoffBatch } from "../app/lib/playoff/playoff-trial.ts";
import { runShadow } from "../app/lib/playoff/engine.ts";

const [source, modelFile, pairing = "published", transition = "exclude"] = process.argv.slice(2);
if (!["published", "swap"].includes(pairing) || !["include", "exclude"].includes(transition))
  throw new Error("Unknown sensitivity scenario");
const capture = JSON.parse(fs.readFileSync(path.join(source, "inputs.json")));
if (capture.season !== 2026 || !capture.coverage.complete) throw new Error("Reconciled 2026 capture required");
const models = JSON.parse(fs.readFileSync(modelFile)).models;
const model = models.colleyVenue;
const transitioning = new Set(["16", "2449"]);
const evidence = JSON.parse(fs.readFileSync(new URL("./data/eligibility-scope-evidence-2026.json", import.meta.url)));
const eligibility = applyEligibility(capture.teams, evidence, 2026, capture.observedAt);
if (eligibility.issues.length) throw new Error(eligibility.issues.join(", "));
const input = Object.freeze({
  ...capture,
  games: Object.freeze(capture.games.map(game => Object.freeze({ ...game,
    teams: Object.freeze(game.teams), scores: Object.freeze(game.scores),
  }))),
  teams: Object.freeze(eligibility.teams.map(team => Object.freeze({
    ...team, eligible: team.eligible ?? (!transitioning.has(team.id) || transition === "include"),
  }))),
});
const ap = [...input.editions].filter(p => p.id === "ap" && p.season === 2026)
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
if (!ap || Date.parse(ap.date) > Date.parse(input.observedAt)) throw new Error("Dated AP baseline required");
const apRank = new Map(ap.ranks.map(team => [team.id, team.rank]));
const { colley } = gameStrengths(input);
const records = currentRecords(input);
const template = runShadow(input).rows;
const venues = new Map();
for (const file of fs.readdirSync(source).filter(name => /^week-\d+\.json$/.test(name))) {
  for (const event of JSON.parse(fs.readFileSync(path.join(source, file))).events ?? []) {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find(team => team.homeAway === "home");
    const away = competition?.competitors?.find(team => team.homeAway === "away");
    if (home && away && typeof competition.neutralSite === "boolean")
      venues.set(String(event.id), { home: String(home.team.id), away: String(away.team.id), neutral: competition.neutralSite });
  }
}
const flex = [
  ["401860926", "36", pairing === "swap" ? "68" : "326"],
  ["401860927", "278", "21"],
  ["401860928", "328", pairing === "swap" ? "326" : "68"],
  ["401860929", "265", "204"],
];
const fixtures = input.games.filter(game => !game.completed).map(game => {
  if (game.state !== "pre" || !(Date.parse(game.date) > Date.parse(input.observedAt)))
    throw new Error("Unresolved regular-season fixture " + game.id);
  const [a, b] = game.teams;
  if (colley.has(a) !== colley.has(b)) {
    const p = models.crossSubdivision.fbsWinProbability;
    return { id: game.id, teams: game.teams, firstTeamWinProbability: colley.has(a) ? p : 1 - p };
  }
  const venue = venues.get(game.id);
  if (!venue || !game.teams.includes(venue.home) || !game.teams.includes(venue.away))
    throw new Error("Unverified venue " + game.id);
  const offset = venue.neutral ? 0 : venue.home === a ? model.home : -model.home;
  return { id: game.id, teams: game.teams, firstTeamWinProbability: gameProbability(colley.get(a) - colley.get(b), model.strength, offset) };
});
for (const [id, home, away] of flex) {
  if (!input.pendingGames.some(game => game.id === id && game.knownTeamIds.includes(home)))
    throw new Error("Flex host no longer matches captured slot");
  fixtures.push({ id, teams: [home, away], firstTeamWinProbability: gameProbability(
    colley.get(home) - colley.get(away), model.strength, model.home,
  ) });
}

const seed = 2026;
const titleSlots = [
  ["401858318", "acc-2026"], ["401869533", "big12-current"],
  ["401869534", "bigten-2026-top-records"], ["401869545", "sec-current"],
];
if (titleSlots.some(([id]) => venues.get(id)?.neutral !== true)) throw new Error("Neutral title venue unverified");
const titleDraw = (index, slot) => {
  let value = (seed + Math.imul(4 * index + slot + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
};
const fixtureTeams = new Map(fixtures.map(game => [game.id, game.teams]));
const titleFirst = new Map();
const example = {};
const started = performance.now();
const result = runPlayoffBatch(fixtures, { trials: 50_000, seed }, (winners, index) => {
  const titles = titleSlots.map(([fixtureId, policy], slot) => ({
    fixtureId, policy, simulatedWinners: winners, conferenceScheduleComplete: true,
    ratings: colley, strengthCoefficient: model.strength, homeCoefficient: model.home,
    verifiedVenue: { kind: "neutral" }, draw: titleDraw(index, slot),
  }));
  const trial = resolvePlayoffTrial(input, titles, (champions, titleParticipants) => {
    const wins = new Map(input.teams.map(team => [team.id, records[team.id].wins]));
    const played = new Map(input.teams.map(team => [team.id, records[team.id].games]));
    for (const [id, winner] of winners) {
      for (const team of fixtureTeams.get(id)) if (played.has(team)) played.set(team, played.get(team) + 1);
      if (wins.has(winner)) wins.set(winner, wins.get(winner) + 1);
    }
    for (const team of titleParticipants) played.set(team, played.get(team) + 1);
    for (const winner of Object.values(champions)) wins.set(winner, wins.get(winner) + 1);
    const rate = id => (wins.get(id) + 1) / (played.get(id) + 2);
    return [...template].sort((a, b) => (apRank.get(a.id) ?? 26) - (apRank.get(b.id) ?? 26) ||
      rate(b.id) - rate(a.id) || Number(a.id) - Number(b.id));
  });
  if (trial.status === "simulated") {
    if (!example.field) Object.assign(example, { index, field: trial.field, firstTwoOut: trial.firstTwoOut });
    for (const [conference, winner] of Object.entries(trial.champions)) {
      const key = conference + ":" + winner;
      titleFirst.set(key, (titleFirst.get(key) ?? 0) + 1);
    }
  }
  return trial;
});
console.log(JSON.stringify({
  asOf: input.observedAt, seed, apDate: ap.date, pairing, transition, flex,
  assumptions: [
    "Ordinary FBS membership presumed eligible absent a documented restriction. Two transitional teams are varied as an explicit sensitivity.",
    "Flex opponents are assumptions; these four games do not enter conference standings.",
    "Power Four titles use neutral sites and the fitted pregame model. Other conference title results are not modeled.",
    "AP ordering is held fixed for ranked teams. Remaining records break unranked ties.",
    "Counts are scenario diagnostics, not calibrated playoff odds. Missing decisive rules withhold the trial.",
  ],
  fixtures: fixtures.length, durationMs: performance.now() - started,
  result, example, titleWinnerCounts: Object.fromEntries(titleFirst),
}, null, 2));
