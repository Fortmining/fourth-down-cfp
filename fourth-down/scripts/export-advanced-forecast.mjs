import fs from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Supply an audit file and an output path");
const audit = JSON.parse(fs.readFileSync(input, "utf8"));
const { result, asOf } = audit;
if (!Number.isFinite(Date.parse(asOf)) || audit.bigTen !== "proxy-sequence" ||
    audit.selection !== "record-response" || result.total !== 50_000 ||
    result.resolved !== result.total || result.withheld !== 0) {
  throw new Error("Forecast requires all 50,000 draws to resolve under the labeled proxy scenario");
}
const ids = new Set([...Object.keys(result.seedCounts), ...Object.keys(result.firstTwoOutCounts),
  ...Object.keys(audit.cohortBounds).filter(key => key.endsWith(":all")).map(key => key.slice(0, -4))]);
const teams = Object.fromEntries([...ids].sort().map(id => [id, {
  seeds: result.seedCounts[id] ?? Array(12).fill(0),
  firstTwoOut: result.firstTwoOutCounts[id] ?? 0,
}]));
const sums = Array(13).fill(0);
for (const { seeds, firstTwoOut } of Object.values(teams)) {
  const counts = [...seeds, firstTwoOut];
  if (counts.length !== 13 || counts.some(count => !Number.isSafeInteger(count) || count < 0) ||
      counts.reduce((sum, count) => sum + count, 0) > result.total) {
    throw new Error("Invalid team outcome counts");
  }
  counts.forEach((count, index) => { sums[index] += count; });
}
if (sums.some((count, index) => count !== result.total * (index === 12 ? 2 : 1))) {
  throw new Error("Seed or first-two-out totals do not reconcile");
}
fs.writeFileSync(output, JSON.stringify({ asOf, draws: result.total, teams }) + "\n");
