import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fitGameCoefficient, fitVenueModel, gameProbability, gameStrengths } from "../app/lib/playoff/game-prediction.ts";
import { validFinal } from "../app/lib/playoff/ledger.ts";

function readSeason(directory, withVenue) {
  const venues = withVenue ? JSON.parse(execFileSync("python3", [
    fileURLToPath(new URL("./extract-historical-venues.py", import.meta.url)), directory,
  ], { encoding: "utf8", maxBuffer: 16_000_000 })) : null;
  const inputs = fs.readdirSync(directory).filter(name => /^inputs-.*\.json$/.test(name))
    .map(name => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const examples = [];
  const seen = new Set();
  for (let index = 1; index < inputs.length; index++) {
    const before = inputs[index - 1];
    const after = inputs[index];
    const { colley, winRate } = gameStrengths(before);
    const scheduled = new Map(before.games.filter(game =>
      game.state === "pre" && !game.completed && Date.parse(game.date) > Date.parse(before.observedAt) &&
      Date.parse(game.observedAt) <= Date.parse(before.observedAt)
    ).map(game => [game.id, game]));
    for (const game of after.games) {
      const known = scheduled.get(game.id);
      if (!known || seen.has(game.id) || game.season !== before.season ||
          known.date !== game.date || !known.teams.every(id => game.teams.includes(id) && colley.has(id)) ||
          !validFinal(game, Date.parse(after.observedAt))) continue;
      const [a, b] = known.teams;
      const venue = venues?.[before.observedAt]?.[game.id];
      if (withVenue && (!venue || venue.date !== known.date ||
          ![venue.home, venue.away].includes(a) || ![venue.home, venue.away].includes(b))) continue;
      const home = !venue || venue.neutral ? 0 : venue.home === a ? 1 : -1;
      seen.add(game.id);
      examples.push({ home, won: Number(game.winner === a), colley: colley.get(a) - colley.get(b), winRate: winRate.get(a) - winRate.get(b) });
    }
  }
  const latest = inputs.at(-1);
  const members = new Set(latest.teams.map(team => team.id));
  const crossSubdivision = latest.games.filter(game =>
    validFinal(game, Date.parse(latest.observedAt)) &&
    game.teams.filter(id => members.has(id)).length === 1
  ).map(game => ({ won: Number(members.has(game.winner)) }));
  return { examples, crossSubdivision };
}

function evaluate(examples, predict) {
  let brier = 0;
  let logLoss = 0;
  const calibration = Array.from({ length: 10 }, () => ({ count: 0, expected: 0, wins: 0 }));
  for (const row of examples) {
    const p = predict(row);
    brier += (p - row.won) ** 2;
    logLoss -= row.won ? Math.log(p) : Math.log1p(-p);
    const bin = calibration[Math.min(9, Math.floor(p * 10))];
    bin.count++;
    bin.expected += p;
    bin.wins += row.won;
  }
  return { brier: brier / examples.length, logLoss: logLoss / examples.length,
    calibration: calibration.map(bin => ({ count: bin.count, meanForecast: bin.count ? bin.expected / bin.count : null, observed: bin.count ? bin.wins / bin.count : null })) };
}

const [trainingDirectory, holdoutDirectory, flag] = process.argv.slice(2);
const withVenue = flag === "--venues";
const { examples: train, crossSubdivision: crossTrain } = readSeason(trainingDirectory, withVenue);
const { examples: holdout, crossSubdivision: crossHoldout } = readSeason(holdoutDirectory, withVenue);
if (!train.length || !holdout.length) throw new Error("Missing historical examples");
const results = { trainingGames: train.length, holdoutGames: holdout.length, models: {} };
for (const key of ["colley", "winRate"]) {
  const coefficient = fitGameCoefficient(train.map(row => ({ won: row.won, difference: row[key] })));
  results.models[key] = { coefficient, ...evaluate(holdout, row => gameProbability(row[key], coefficient)) };
}
if (withVenue) {
  const model = fitVenueModel(train.map(row => ({ won: row.won, difference: row.colley, home: row.home })));
  results.models.colleyVenue = { ...model, ...evaluate(holdout, row => gameProbability(row.colley, model.strength, row.home * model.home)) };
}
if (crossTrain.length && crossHoldout.length) {
  const fbsWinProbability = (1 + crossTrain.reduce((sum, row) => sum + row.won, 0)) / (2 + crossTrain.length);
  results.models.crossSubdivision = {
    fbsWinProbability, trainingGames: crossTrain.length, holdoutGames: crossHoldout.length,
    ...evaluate(crossHoldout, () => fbsWinProbability),
  };
}
results.models.coin = evaluate(holdout, () => 0.5);
console.log(JSON.stringify(results, null, 2));
