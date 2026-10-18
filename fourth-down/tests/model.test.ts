import { test } from "node:test";
import assert from "node:assert/strict";
import { tierFor, movement, matchups } from "../app/lib/model.ts";
test("outlook boundaries cover exactly the 25 ranked positions", () => {
  for (let rank = 1; rank <= 25; rank++) assert.ok(tierFor(rank));
  assert.equal(tierFor(4).name, "Leading the race");
  assert.equal(tierFor(5).name, "In the conversation");
  assert.equal(tierFor(12).name, "In the conversation");
  assert.equal(tierFor(13).name, "On the bubble");
  assert.equal(tierFor(18).name, "On the bubble");
  assert.equal(tierFor(19).name, "Chasing the field");
  assert.equal(tierFor(26), undefined);
});
test("movement distinguishes a new entry from actual rank changes", () => {
  const t = {
    rank: 10,
    previous: 12,
    teamId: "1",
    name: "Team",
    record: "6-0",
    conference: "ACC",
  };
  assert.equal(movement(t), 2);
  assert.equal(movement({ ...t, previous: 8 }), -2);
  assert.equal(movement({ ...t, previous: 0 }), null);
  assert.equal(movement({ ...t, previous: 26 }), null);
});
test("bracket contains all twelve seeds exactly once with correct advancement", () => {
  assert.deepEqual(
    matchups.flatMap((m) => [m.host, m.away, m.bye]).sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    matchups.map((m) => [m.host, m.away, m.bye]),
    [
      [8, 9, 1],
      [5, 12, 4],
      [7, 10, 2],
      [6, 11, 3],
    ],
  );
});
