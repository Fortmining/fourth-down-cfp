import { hash, runShadow, candidates } from "./engine.ts";
import type { Inputs } from "./types";

export type Vintage = {
  schema: 1;
  receivedAt: string;
  provenance: "captured-live" | "legacy-capture-import" | "reconstructed";
  sourceHashes: Record<string, string>;
  inputHash: string;
  inputs: Inputs;
};

/** Publication dates and game dates are not observation timestamps. */
export function validateVintage(v: Vintage, asOf: string) {
  const errors: string[] = [];
  const cutoff = Date.parse(asOf),
    received = Date.parse(v.receivedAt);
  if (
    !Number.isFinite(cutoff) ||
    !Number.isFinite(received) ||
    received > cutoff
  )
    errors.push("Capture not available at cutoff");
  if (v.provenance !== "captured-live")
    errors.push("Not a contemporaneous capture receipt");
  if (
    !Object.keys(v.sourceHashes).length ||
    Object.values(v.sourceHashes).some((h) => !/^[a-f0-9]{64}$/.test(h))
  )
    errors.push("Missing source content identities");
  if (hash(v.inputs) !== v.inputHash) errors.push("Input identity mismatch");
  const epoch = Date.parse(v.inputs.observedAt);
  if (!Number.isFinite(epoch) || epoch > received || epoch > cutoff)
    errors.push("Input epoch later than capture/cutoff");
  for (const g of [...v.inputs.games, ...(v.inputs.pendingGames || [])]) {
    const at = Date.parse(g.observedAt);
    if (!Number.isFinite(at) || at > epoch || at > cutoff)
      errors.push("Future or invalid game observation: " + g.id);
  }
  if (v.inputs.games.some((g) => g.season !== v.inputs.season))
    errors.push("Wrong-season game in vintage");
  for (const e of v.inputs.editions)
    if (
      e.season !== v.inputs.season ||
      !Number.isFinite(Date.parse(e.date)) ||
      Date.parse(e.date) > epoch
    )
      errors.push("Future/wrong-season published edition: " + e.id);
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function selectVintage(
  vintages: Vintage[],
  asOf: string,
): Vintage | null {
  return (
    vintages
      .filter((v) => validateVintage(v, asOf).valid)
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))[0] ||
    null
  );
}

/** Never substitute a revised season ledger for a missing historical vintage. */
export function compareAsOf(vintages: Vintage[], cutoffs: string[]) {
  return cutoffs.map((asOf) => {
    const vintage = selectVintage(vintages, asOf);
    if (!vintage)
      return {
        asOf,
        status: "unavailable",
        reason: "No contemporaneous inputs; no backfilled forecast",
        models: [],
      };
    return {
      asOf,
      status: "observed-shadow",
      receivedAt: vintage.receivedAt,
      inputHash: vintage.inputHash,
      models: candidates.map((w) => {
        const s = runShadow(vintage.inputs, w);
        return {
          weights: w.id,
          snapshotId: s.id,
          top12Resume: s.rows.slice(0, 12).map((r) => r.id),
          fieldWithheld: true,
        };
      }),
    };
  });
}
