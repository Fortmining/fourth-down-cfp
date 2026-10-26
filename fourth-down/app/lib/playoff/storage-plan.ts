import { gzipSync, gunzipSync } from "node:zlib";
import { hash, runShadow } from "./engine.ts";
import type { Snapshot } from "./types";

/** Private dry-run format only. No Redis transport or scheduler hook is installed. */
export function packSnapshotPair(confirmed: Snapshot, provisional: Snapshot) {
  if (
    confirmed.mode !== "confirmed" ||
    provisional.mode !== "provisional" ||
    confirmed.inputHash !== provisional.inputHash ||
    hash(confirmed.weights) !== hash(provisional.weights)
    || confirmed.modelVersion !== provisional.modelVersion
  )
    throw Error("Snapshot pair must share an input receipt");
  const value = {
    schema: 1,
    ...(confirmed.modelVersion==='resume-shadow-v1.2.0'?{modelVersion:confirmed.modelVersion}:{}),
    inputs: confirmed.inputs,
    weights: confirmed.weights,
    confirmedId: confirmed.id,
    provisionalId: provisional.id,
    provisionalParent: provisional.parentId,
  };
  const raw = Buffer.from(JSON.stringify(value)),
    compressed = gzipSync(raw);
  return {
    id: hash(value),
    encoded: compressed.toString("base64"),
    rawBytes: raw.length,
    compressedBytes: compressed.length,
    redisValueBytes: Buffer.byteLength(compressed.toString("base64")),
  };
}
export function replaySnapshotPair(encoded: string) {
  const value = JSON.parse(
    gunzipSync(Buffer.from(encoded, "base64"), {
      maxOutputLength: 2 * 1024 * 1024,
    }).toString(),
  );
  if (value.schema !== 1) throw Error("Unsupported bundle schema");
  const version=value.modelVersion??'resume-shadow-v1.1.0';
  const c = runShadow(value.inputs, value.weights,false,null,version),
    p = runShadow(value.inputs, value.weights, true, value.provisionalParent,version);
  if (c.id !== value.confirmedId || p.id !== value.provisionalId)
    throw Error("Bundle replay mismatch");
  return { confirmed: c, provisional: p };
}
export function storageWriteBudget(
  values: { redisValueBytes: number }[],
  monthlyCommandsUsed: number,
  notificationCommandsReserved: number,
  storageUsedBytes: number,
) {
  if (
    [
      monthlyCommandsUsed,
      notificationCommandsReserved,
      storageUsedBytes,
      ...values.map((v) => v.redisValueBytes),
    ].some((n) => !Number.isSafeInteger(n) || n < 0)
  )
    throw Error("Invalid budget observation");
  const maxBytes = Math.max(0, ...values.map((v) => v.redisValueBytes));
  const commandAllowance = Math.max(
    0,
    400000 - monthlyCommandsUsed - notificationCommandsReserved,
  );
  // Conservative command accounting: immutable SET NX + index ZADD + CAS EVAL/GET/SET.
  const commandsPerMeaningfulPair = 5;
  return {
    transportInstalled: false,
    additionalSchedules: 0,
    additionalQstashDeliveries: 0,
    commandsPerMeaningfulPair,
    commandAllowance,
    maxPairsByCommandBudget: Math.floor(
      commandAllowance / commandsPerMeaningfulPair,
    ),
    maxMeasuredPairBytes: maxBytes,
    storageReserveBytes: 64 * 1024 * 1024,
    maxPairsByStorageBudget: maxBytes
      ? Math.floor(
          Math.max(
            0,
            Math.min(64 * 1024 * 1024, 200000000 - storageUsedBytes),
          ) / maxBytes,
        )
      : 0,
    periodicReadCommandsPer30DaysIfOneAddedPerCheck: 10800,
    productionActivationPermitted: false,
    limitation:
      "Actual Redis billing, CAS retries, allocator/index overhead and production CPU remain unmeasured. The command reserve must come from representative complete-day observations; no quota guarantee is inferred from low current usage.",
  };
}
