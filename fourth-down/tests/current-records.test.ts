import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCurrentRecords } from "../app/lib/current-records.ts";
const games = [
  { date: "2026-10-24", teams: [{ id: "2633", record: "6-2" }] },
  { date: "2026-11-01", teams: [{ id: "2633", record: "6-1" }] },
];
test("public record foundation reads current season totals independently of poll publication, with efficient caching", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.match(String(url), /standings\?season=2026/);
      assert.equal(options?.cache, "no-store");
      return Response.json({
        season: { year: 2026 },
        children: [
          {
            id: "8",
            standings: {
              entries: [
                {
                  team: { id: "2633", displayName: "Tennessee" },
                  stats: [
                    { name: "overall", displayValue: "6-2" },
                    { name: "vs. Conf.", displayValue: "3-2" },
                  ],
                },
              ],
            },
          },
        ],
      });
    };
    const result = await loadCurrentRecords(games, 2026, "2026-10-25T12:00Z");
    assert.equal(result.currentRecords["2633"].overall, "6-2");
    assert.equal(result.currentRecords["2633"].conference, "3-2");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("missing or wrong-season standings retain only actual scoreboard records and never publication defaults", async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [
      () => {
        throw Error("offline");
      },
      () => Response.json({ season: { year: 2025 }, children: [] }),
    ]) {
      globalThis.fetch = async () => response();
      const result = await loadCurrentRecords(games, 2026, "2026-10-25T12:00Z");
      assert.equal(result.currentRecords["2633"].overall, "6-2");
      assert.equal(result.currentRecords["2633"].source, "ESPN scoreboard");
      assert.match(result.recordStatus, /unavailable/);
      assert.equal(result.currentRecords["missing"], undefined);
    }
  } finally {
    globalThis.fetch = original;
  }
});
test("missing current data never manufactures a record for a ranked bye team", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw Error("offline");
    };
    const result = await loadCurrentRecords([], 2026, "2026-10-25T12:00Z");
    assert.deepEqual(result.currentRecords, {});
  } finally {
    globalThis.fetch = original;
  }
});
test("conflicting provider totals are withheld rather than choosing an invented correction or stale count", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({
        season: { year: 2026 },
        children: [
          {
            id: "8",
            standings: {
              entries: [
                {
                  team: { id: "2633", displayName: "Tennessee" },
                  stats: [{ name: "overall", displayValue: "6-1" }],
                },
              ],
            },
          },
        ],
      });
    const result = await loadCurrentRecords(games, 2026, "2026-10-25T12:00Z");
    assert.equal(result.currentRecords["2633"].status, "unavailable");
    assert.match(result.recordStatus, /Conflicting/);
  } finally {
    globalThis.fetch = original;
  }
});
