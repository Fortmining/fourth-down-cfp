import fs from "node:fs";
import path from "node:path";
import { fitGameCoefficient, gameProbability, gameStrengths } from "../app/lib/playoff/game-prediction.ts";
import { validFinal } from "../app/lib/playoff/ledger.ts";

function readSeason(directory) {
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
      seen.add(game.id);
      examples.push({ won: Number(game.winner === a), colley: colley.get(a) - colley.get(b), winRate: winRate.get(a) - winRate.get(b) });
    }
  }
  return examples;
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

const [trainingDirectory, holdoutDirectory] = process.argv.slice(2);
const train = readSeason(trainingDirectory);
const holdout = readSeason(holdoutDirectory);
if (!train.length || !holdout.length) throw new Error("Missing historical examples");
const results = { trainingGames: train.length, holdoutGames: holdout.length, models: {} };
for (const key of ["colley", "winRate"]) {
  const coefficient = fitGameCoefficient(train.map(row => ({ won: row.won, difference: row[key] })));
  results.models[key] = { coefficient, ...evaluate(holdout, row => gameProbability(row[key], coefficient)) };
}
results.models.coin = evaluate(holdout, () => 0.5);
console.log(JSON.stringify(results, null, 2));
