import fs from "node:fs";
import path from "node:path";
import { hash, runShadow, candidates, compareSnapshots } from "./engine.ts";
import { ShadowArchive } from "./archive.ts";
import { validateVintage, type Vintage } from "./temporal.ts";
import { scheduleAudit } from "./schedule.ts";
import type { Snapshot } from "./types";

type Head = {
  id: string;
  receivedAt: string;
  confirmed: string;
  provisional: string;
  receipt: string;
  eventKey: string;
};
export class ShadowSession {
  readonly archive: ShadowArchive;
  readonly directory: string;
  readonly maxBytes: number;
  constructor(directory: string, maxBytes = 64 * 1024 * 1024) {
    this.directory = directory;
    this.maxBytes = maxBytes;
    fs.mkdirSync(directory, { recursive: true });
    this.archive = new ShadowArchive(
      path.join(directory, "archive"),
      maxBytes,
      768,
    );
    fs.mkdirSync(path.join(directory, "receipts"), { recursive: true });
  }
  private usage() {
    const size = (d: string): number =>
      fs
        .readdirSync(d, { withFileTypes: true })
        .reduce(
          (n, e) =>
            n +
            (e.isDirectory()
              ? size(path.join(d, e.name))
              : fs.statSync(path.join(d, e.name)).size),
          0,
        );
    return size(this.directory);
  }
  ingest(
    vintage: Vintage,
    options: { reserveBytes?: number; compareAlternatives?: boolean } = {},
  ) {
    const reserve = options.reserveBytes || 0;
    if (!Number.isSafeInteger(reserve) || reserve < 0)
      throw Error("Invalid reserved storage budget");
    const validity = validateVintage(vintage, vintage.receivedAt);
    if (!validity.valid) throw Error(validity.errors.join("; "));
    const lock = path.join(this.directory, "session.lock");
    let fd: number;
    try {
      fd = fs.openSync(lock, "wx");
    } catch {
      throw Error("Shadow session busy; no concurrent history writes");
    }
    try {
      const headFile = path.join(this.directory, "head.json");
      const before: Head | null = fs.existsSync(headFile)
        ? JSON.parse(fs.readFileSync(headFile, "utf8"))
        : null;
      if (
        before &&
        Date.parse(vintage.receivedAt) < Date.parse(before.receivedAt)
      )
        throw Error("Out-of-order observation; retained history unchanged");
      const input = vintage.inputs;
      const eventKey = hash({
        season: input.season,
        rules: input.rulesVersion,
        teams: input.teams,
        games: input.games.map((g) => ({
          id: g.id,
          season: g.season,
          date: g.date,
          teams: g.teams,
          // Live clock/score updates are retained only if the model's provisional
          // assumptions actually change. Confirmed score corrections are evidence.
          ...(g.state === "post"
            ? {
                completed: g.completed,
                winner: g.winner,
                scores: g.scores,
                conferenceGame: g.conferenceGame,
              }
            : {}),
        })),
        editions: input.editions,
        pending: input.pendingGames?.map(({ observedAt, source, ...g }) => {
          void observedAt;
          void source;
          return g;
        }),
        coverage: input.coverage,
      });
      // Re-evaluate time-based live expiry; no-op observations update only current head.
      const confirmed = runShadow(input),
        provisional = runShadow(input, undefined, true, confirmed.id);
      const changed =
        !before ||
        before.eventKey !== eventKey ||
        before.confirmed !== confirmed.id ||
        before.provisional !== provisional.id;
      const receiptId = changed ? hash(vintage) : before!.receipt,
        receipt = path.join(this.directory, "receipts", receiptId + ".json");
      const archiveBytes = this.archive.bytes;
      // Preflight the entire write on an isolated archive so a cap cannot strand head/history.
      const staging = path.join(this.directory, ".staging-" + process.pid);
      fs.mkdirSync(staging, { recursive: true });
      let modelSnapshots: Snapshot[] = [];
      try {
        if (changed) {
          modelSnapshots = options.compareAlternatives
            ? candidates.flatMap((w) => {
                const c = runShadow(input, w);
                return [c, runShadow(input, w, true, c.id)];
              })
            : [confirmed, provisional];
          const probe = new ShadowArchive(staging, this.maxBytes, 768);
          for (const s of modelSnapshots) probe.save(s);
          probe.storeInputs(input);
          // Conservatively includes duplicated content already held in the real archive.
          if (this.usage() + probe.bytes + reserve + 4096 > this.maxBytes)
            throw Error(
              "Session storage budget exhausted; head/history unchanged",
            );
          if (
            this.archive.count +
              modelSnapshots.filter(
                (s) =>
                  !fs.existsSync(
                    path.join(
                      this.archive.directory,
                      "snapshots",
                      s.id + ".json",
                    ),
                  ),
              ).length >
            768
          )
            throw Error("Snapshot cap reached; head/history unchanged");
        } else if (this.usage() + reserve + 4096 > this.maxBytes)
          throw Error("Session receipt budget exhausted");
      } finally {
        fs.rmSync(staging, { recursive: true, force: true });
      }
      for (const s of modelSnapshots) this.archive.save(s);
      if (changed && !fs.existsSync(receipt)) {
        const { inputs, ...meta } = vintage;
        fs.writeFileSync(
          receipt,
          JSON.stringify({
            ...meta,
            inputRef: this.archive.storeInputs(inputs),
          }),
          { flag: "wx" },
        );
      }
      const movements =
        before && before.confirmed !== confirmed.id
          ? compareSnapshots(this.archive.restore(before.confirmed), confirmed)
          : [];
      const head: Head = {
        id: hash({
          receiptId,
          confirmed: confirmed.id,
          provisional: provisional.id,
        }),
        receivedAt: vintage.receivedAt,
        confirmed: confirmed.id,
        provisional: provisional.id,
        receipt: receiptId,
        eventKey,
      };
      fs.writeFileSync(headFile + ".tmp", JSON.stringify(head));
      fs.renameSync(headFile + ".tmp", headFile);
      return {
        shadow: true,
        publicActivation: false,
        changed,
        head,
        movements,
        schedule: scheduleAudit(input),
        storedNewSnapshots: this.archive.bytes !== archiveBytes,
        snapshots: this.archive.count,
        bytes: this.usage(),
        redisCommands: 0,
        qstashDeliveries: 0,
        sourceRequests: 0,
      };
    } finally {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  }
  receipts(): Vintage[] {
    return fs
      .readdirSync(path.join(this.directory, "receipts"))
      .filter((f) => /^[a-f0-9]{64}\.json$/.test(f))
      .map((f) => {
        const { inputRef, ...meta } = JSON.parse(
          fs.readFileSync(path.join(this.directory, "receipts", f), "utf8"),
        );
        const v = {
          ...meta,
          inputs: this.archive.restoreInputs(inputRef),
        } as Vintage;
        if (hash(v) !== f.slice(0, -5)) throw Error("Receipt content mismatch");
        return v;
      });
  }
}
