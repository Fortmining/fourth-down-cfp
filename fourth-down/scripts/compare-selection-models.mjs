import fs from "node:fs";
import path from "node:path";
import { colleyReference } from "../app/lib/playoff/colley-reference.ts";
import { gameStrengths } from "../app/lib/playoff/game-prediction.ts";
import { currentRecords } from "../app/lib/playoff/ledger.ts";
import { historicalFieldProxy, selectionMetrics } from "../app/lib/playoff/selection-benchmark.ts";

const targets = JSON.parse(fs.readFileSync(new URL("./data/selection-targets.json", import.meta.url)));
const rows = [];
for (const directory of process.argv.slice(2)) {
  for (const file of fs.readdirSync(directory).filter(name => /^inputs-.*\.json$/.test(name))) {
    const input = JSON.parse(fs.readFileSync(path.join(directory, file)));
    const target = targets.find(t => t.season === input.season);
    if (!target || !input.coverage.complete) continue;
    const at = Date.parse(input.observedAt);
    if (!Number.isFinite(at) || at >= Date.parse(target.selectionDay + "T00:00:00Z") ||
        input.games.some(game => !(Date.parse(game.observedAt) <= at) || (game.completed && !(Date.parse(game.date) <= at)))) {
      throw new Error("Historical cutoff violated");
    }
    const edition = input.editions.filter(poll => poll.id === "ap" && poll.season === input.season &&
      Date.parse(poll.date) <= at - 86_400_000).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    if (!edition) continue;
    const ap = new Map(edition.ranks.map(row => [row.id, row.rank]));
    const { colley, winRate } = gameStrengths(input);
    const colleyOrder = colleyReference(input).rows.map(row => row.id);
    const colleyRank = new Map(colleyOrder.map((id, i) => [id, i + 1]));
    const compareAp = (a, b) => (ap.get(a) ?? 26) - (ap.get(b) ?? 26);
    const compareRecord = (a, b) => winRate.get(b) - winRate.get(a);
    const blend = id => (ap.get(id) ?? 26) + Math.min(26, colleyRank.get(id));
    // Apply the same record-response coefficient using only finals known after the AP anchor.
    const anchorAt = Date.parse(edition.date);
    const anchor = currentRecords({ ...input, games: input.games.filter(game =>
      game.completed && Date.parse(game.date) < anchorAt) });
    const current = currentRecords(input);
    const smoothed = record => (record.wins + 1) / (record.games + 2);
    const response = id => (ap.get(id) ?? 26) - 36 * (smoothed(current[id]) - smoothed(anchor[id]));
    const orders = {
      recordResponse: [...colley.keys()].sort((a, b) => response(a) - response(b) ||
        compareRecord(a, b) || Number(a) - Number(b)),
      colley: colleyOrder,
      ap: [...colley.keys()].sort((a, b) => compareAp(a, b) || compareRecord(a, b) || Number(a) - Number(b)),
      hybrid: [...colley.keys()].sort((a, b) => blend(a) - blend(b) || compareAp(a, b) ||
        colleyRank.get(a) - colleyRank.get(b)),
    };
    const models = Object.fromEntries(Object.entries(orders).map(([id, order]) => {
      const field = historicalFieldProxy(order, input);
      return [id, selectionMetrics(field.seeds, target.seeds)];
    }));
    rows.push({ season: input.season, asOf: input.observedAt, apDate: edition.date, models });
  }
}
if (!rows.length) throw new Error("No eligible time-correct replay windows");
rows.sort((a, b) => a.asOf.localeCompare(b.asOf));
const summary = [2024, 2025].map(season => {
  const group = rows.filter(row => row.season === season);
  return {
    season, windows: group.length,
    meanSelected: Object.fromEntries(Object.keys(rows[0].models).map(id => [
      id, group.length ? group.reduce((sum, row) => sum + row.models[id].selectedCorrect, 0) / group.length : null,
    ])),
  };
});
console.log(JSON.stringify({
  method: "AP ranks with record fallback, Colley only, fixed equal-weight capped-rank hybrid, and record response since the AP anchor",
  allocation: "Shared historical champion proxy. Replays overlap and do not validate championship forecasts or probabilities.",
  summary, rows,
}, null, 2));
