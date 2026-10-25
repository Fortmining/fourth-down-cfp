import fs from "node:fs";
import path from "node:path";
import { hash, runShadow } from "./engine.ts";
import type { Inputs, Snapshot } from "./types";
export class ShadowArchive {
  readonly directory: string;
  readonly maxBytes: number;
  readonly maxSnapshots: number;
  bytes = 0;
  count = 0;
  private known = new Set<string>();
  constructor(
    directory: string,
    maxBytes = 64 * 1024 * 1024,
    maxSnapshots = 768,
  ) {
    this.directory = directory;
    this.maxBytes = maxBytes;
    this.maxSnapshots = maxSnapshots;
    for (const folder of ["blobs", "snapshots"]) {
      fs.mkdirSync(path.join(directory, folder), { recursive: true });
      for (const f of fs.readdirSync(path.join(directory, folder))) {
        this.bytes += fs.statSync(path.join(directory, folder, f)).size;
        this.known.add(folder + "/" + f);
        if (folder === "snapshots") this.count++;
      }
    }
  }
  private write(folder: string, id: string, value: unknown) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("Invalid archive identity");
    const key = folder + "/" + id + ".json",
      file = path.join(this.directory, key);
    if (this.known.has(key)) return file;
    const raw = JSON.stringify(value);
    const bytes = Buffer.byteLength(raw);
    if (this.bytes + bytes > this.maxBytes)
      throw Error("Archive byte budget exhausted; retained history unchanged");
    fs.writeFileSync(file, raw, { flag: "wx" });
    this.known.add(key);
    this.bytes += bytes;
    return file;
  }
  private blob(value: unknown) {
    const id = hash(value);
    this.write("blobs", id, value);
    return id;
  }
  storeInputs(i: Inputs) {
    const observations: { observedAt: string; source: string }[] = [];
    const games = i.games.map((g) => {
      const { observedAt, source, ...facts } = g;
      let index = observations.findIndex(
        (o) => o.observedAt === observedAt && o.source === source,
      );
      if (index < 0) {
        index = observations.length;
        observations.push({ observedAt, source });
      }
      return [this.blob(facts), index];
    });
    const manifest = {
      season: i.season,
      observedAt: i.observedAt,
      coverage: i.coverage,
      rulesVersion: i.rulesVersion,
      teams: this.blob(i.teams),
      editions: this.blob(i.editions),
      observations,
      games,
      pendingGames: i.pendingGames,
    };
    return this.blob(manifest);
  }
  save(s: Snapshot) {
    const existing = path.join(this.directory, "snapshots", s.id + ".json");
    if (fs.existsSync(existing)) return existing;
    if (this.count >= this.maxSnapshots)
      throw Error("Archive snapshot limit reached; retained history unchanged");
    const compact = {
      schema: 2,
      id: s.id,
      inputHash: s.inputHash,
      modelVersion: s.modelVersion,
      rulesVersion: s.rulesVersion,
      at: s.at,
      shadow: true,
      mode: s.mode,
      parentId: s.parentId,
      weights: s.weights,
      inputRef: this.storeInputs(s.inputs),
      anchorIds: s.anchorIds,
      assumptions: s.assumptions,
      issues: s.issues,
      field: s.field,
      rows: s.rows.map((r) => [
        r.id,
        r.position,
        r.score,
        [r.components.W, r.components.R, r.components.S, r.components.P],
        r.record,
        r.conferenceRecord,
        r.remainingDifficulty,
        r.modelTie,
      ]),
    };
    if (Buffer.byteLength(JSON.stringify(compact)) > 32768)
      throw Error("Snapshot exceeds 32 KiB budget");
    const file = this.write("snapshots", s.id, compact);
    this.count++;
    return file;
  }
  private readBlob(id: string): any {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("Invalid archive reference");
    const value = JSON.parse(
      fs.readFileSync(path.join(this.directory, "blobs", id + ".json"), "utf8"),
    );
    if (hash(value) !== id) throw Error("Corrupt archive input");
    return value;
  }
  restoreInputs(ref: string): Inputs {
    const m = this.readBlob(ref);
    return {
      ...(m.pendingGames ? { pendingGames: m.pendingGames } : {}),
      season: m.season,
      observedAt: m.observedAt,
      coverage: m.coverage,
      rulesVersion: m.rulesVersion,
      teams: this.readBlob(m.teams),
      editions: this.readBlob(m.editions),
      games: m.games.map((r: string | [string, number]) =>
        typeof r === "string"
          ? this.readBlob(r)
          : { ...this.readBlob(r[0]), ...m.observations[r[1]] },
      ),
    };
  }
  restore(id: string): Snapshot {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("Invalid snapshot ID");
    const saved = JSON.parse(
      fs.readFileSync(
        path.join(this.directory, "snapshots", id + ".json"),
        "utf8",
      ),
    );
    if (
      ![1, 2].includes(saved.schema) ||
      saved.id !== id ||
      saved.modelVersion !== "resume-shadow-v1.1.0"
    )
      throw Error("Unsupported archive schema");
    const input = this.restoreInputs(saved.inputRef);
    if (hash(input) !== saved.inputHash) throw Error("Input hash mismatch");
    const snapshot = runShadow(
      input,
      saved.weights,
      saved.mode === "provisional",
      saved.parentId,
    );
    if (snapshot.id !== id || snapshot.rulesVersion !== saved.rulesVersion)
      throw Error("Replay mismatch");
    const rows = snapshot.rows.map((r) => [
      r.id,
      r.position,
      r.score,
      [r.components.W, r.components.R, r.components.S, r.components.P],
      r.record,
      r.conferenceRecord,
      r.remainingDifficulty,
      r.modelTie,
    ]);
    if (
      hash(rows) !== hash(saved.rows) ||
      hash(snapshot.assumptions) !== hash(saved.assumptions) ||
      hash(snapshot.field) !== hash(saved.field) ||
      hash(snapshot.issues) !== hash(saved.issues)
    )
      throw Error("Snapshot payload mismatch");
    return snapshot;
  }
}
