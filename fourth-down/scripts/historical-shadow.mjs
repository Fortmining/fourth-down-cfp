import fs from "node:fs";
import path from "node:path";
import {
  verifyGitVintage,
  historicalComparison,
} from "../app/lib/playoff/historical.ts";
const root = process.env.SHADOW_HISTORY;
if (!root)
  throw Error("Set SHADOW_HISTORY to prepared private historical inputs");
const metadata = JSON.parse(
  fs.readFileSync(path.join(root, "prepared-vintages.json"), "utf8"),
);
const vintages = metadata.map((m) => {
  const inputs = JSON.parse(fs.readFileSync(m.inputsFile, "utf8")),
    v = { ...m, inputs };
  const check = verifyGitVintage(
    v,
    fs.readFileSync(path.join(root, m.sha + ".csv")),
  );
  if (!check.valid) throw Error(check.errors.join("; "));
  return v;
});
const report = historicalComparison(vintages,process.env.SHADOW_MODEL_VERSION||'resume-shadow-v1.1.0');
fs.writeFileSync(
  path.join(root, "historical-validation.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      aggregate: report.aggregate,
      windows: report.results.map((r) => ({
        asOf: r.asOf,
        outcomes: r.outcomes,
        coverageComplete: r.coverageComplete,
      })),
      limitations: report.limitations,
    },
    null,
    2,
  ),
);
