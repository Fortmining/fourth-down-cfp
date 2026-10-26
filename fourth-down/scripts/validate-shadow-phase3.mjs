// Explicit offline analysis. Never imported by app routes or notification dispatch.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import { runShadow } from "../app/lib/playoff/engine.ts";
import {
  modelSensitivity,
  championshipContext,
} from "../app/lib/playoff/sensitivity.ts";
import {
  packSnapshotPair,
  replaySnapshotPair,
  storageWriteBudget,
} from "../app/lib/playoff/storage-plan.ts";
const seed = process.env.SHADOW_SEED,
  output = process.env.SHADOW_REPORT;
if (!seed || !output)
  throw Error("Set SHADOW_SEED and SHADOW_REPORT to private paths");
if (path.resolve(output).startsWith(path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..") + path.sep))
  throw Error("Keep private analysis outside the app directory");
const inputs = JSON.parse(fs.readFileSync(seed)),
  confirmed = runShadow(inputs),
  provisional = runShadow(inputs, undefined, true, confirmed.id);
const packed = packSnapshotPair(confirmed, provisional);
replaySnapshotPair(packed.encoded);
const report = {
  sourceInputAt: inputs.observedAt,
  analysisAt: new Date().toISOString(),
  sensitivity: modelSensitivity(inputs),
  championship: championshipContext(inputs),
  bundle: {
    rawBytes: packed.rawBytes,
    compressedBytes: packed.compressedBytes,
    redisValueBytes: packed.redisValueBytes,
  },
  illustrativeBudget: storageWriteBudget([packed], 36000, 360000, 15000000),
  budgetNote:
    "The reserve is an illustrative stress scenario using previously observed usage, not a newly measured production allocation.",
  productionWrites: 0,
  qstashDeliveries: 0,
  networkRequests: 0,
  activationPermitted: false,
};
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    bundle: report.bundle,
    networkRequests: 0,
    productionWrites: 0,
    activationPermitted: false,
  }),
);
