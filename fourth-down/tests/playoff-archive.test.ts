import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ShadowArchive } from "../app/lib/playoff/archive.ts";
import { runShadow, hash } from "../app/lib/playoff/engine.ts";
import type { Inputs } from "../app/lib/playoff/types.ts";
const input: Inputs = {
  season: 2026,
  observedAt: "2026-10-25T03:00Z",
  teams: [{ id: "1", name: "One", conference: "8", eligible: null }],
  games: [],
  editions: [],
  coverage: { complete: false, issues: ["fixture"] },
  rulesVersion: "cfp-2026-unverified-conference-adapters",
};
test("content-addressed local archive restores exact inputs and results and deduplicates no-op refreshes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-shadow-"));
  try {
    const a = new ShadowArchive(dir),
      s = runShadow(input);
    a.save(s);
    const bytes = a.bytes;
    assert.equal(hash(a.restore(s.id)), hash(s));
    a.save(runShadow({ ...input, observedAt: "2026-10-25T03:01Z" }));
    assert.equal(a.count, 1);
    assert.equal(a.bytes, bytes);
    const reopened = new ShadowArchive(dir);
    assert.equal(reopened.count, 1);
    assert.equal(hash(reopened.restore(s.id)), hash(s));
    assert.throws(() => a.restore("../secret"), /Invalid/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("archive enforces byte/snapshot budgets and detects corrupted stored inputs", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-shadow-"));
  try {
    const tiny = new ShadowArchive(dir, 1);
    assert.throws(() => tiny.save(runShadow(input)), /budget/);
    assert.equal(tiny.count, 0);
    const a = new ShadowArchive(dir),
      s = runShadow(input);
    a.save(s);
    const files = fs.readdirSync(path.join(dir, "blobs"));
    fs.writeFileSync(path.join(dir, "blobs", files[0]), "{}");
    assert.throws(() => a.restore(s.id), /Corrupt/);
    const capped = new ShadowArchive(dir, 64 * 1024 * 1024, 1);
    assert.throws(
      () =>
        capped.save(
          runShadow({
            ...input,
            teams: [
              ...input.teams,
              { id: "2", name: "Two", conference: "1", eligible: null },
            ],
          }),
        ),
      /limit/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("source observation refresh does not duplicate unchanged event facts when a different result changes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-shadow-"));
  try {
    const i: Inputs = {
      ...input,
      teams: [
        { id: "1", name: "One", conference: "8", eligible: true },
        { id: "2", name: "Two", conference: "8", eligible: true },
      ],
      coverage: { complete: true, issues: [] },
      games: [1, 2, 3].map((n) => ({
        id: String(n),
        season: 2026,
        date: "2026-10-24T12:00Z",
        state: "post",
        completed: true,
        teams: ["1", "2"],
        scores: [24, 17],
        winner: "1",
        conferenceGame: true,
        period: 4,
        clock: 0,
        observedAt: input.observedAt,
        source: "fixture",
      })),
    };
    const a = new ShadowArchive(dir),
      s = runShadow(i);
    a.save(s);
    const count = fs.readdirSync(path.join(dir, "blobs")).length;
    i.observedAt = "2026-10-25T04:00Z";
    i.games = i.games.map((g, n) => ({
      ...g,
      observedAt: i.observedAt,
      ...(n === 0 ? { scores: [17, 24] as [number, number], winner: "2" } : {}),
    }));
    const updated = runShadow(i);
    a.save(updated);
    assert.ok(fs.readdirSync(path.join(dir, "blobs")).length - count <= 3);
    assert.equal(hash(a.restore(s.id)), hash(s));
    assert.equal(hash(a.restore(updated.id)), hash(updated));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("unassigned schedule entries and partial future coverage survive exact archive replay", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-shadow-"));
  try {
    const i: Inputs = {
      ...input,
      coverage: { complete: true, futureComplete: false, issues: [] },
      pendingGames: [
        {
          id: "12",
          name: "TBD at One",
          date: "2026-12-05T00:00Z",
          knownTeamIds: ["1"],
          observedAt: input.observedAt,
          source: "fixture",
        },
      ],
    };
    const a = new ShadowArchive(dir),
      s = runShadow(i);
    a.save(s);
    assert.equal(hash(a.restore(s.id)), hash(s));
    assert.equal(a.restore(s.id).inputs.pendingGames?.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
