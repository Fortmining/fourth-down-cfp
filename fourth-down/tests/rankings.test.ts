import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectPolls,
  defaultPoll,
  comparisonRows,
} from "../app/lib/rankings.ts";
const now = new Date("2026-10-18T18:00Z");
const team = (id: string, rank: number) => ({
  current: rank,
  previous: rank + 1,
  team: { id, location: "Team", name: id },
  recordSummary: "6-0",
});
const poll = (name: string, week = 8, year = 2026, ranks = [team("1", 1)]) => ({
  name,
  season: { year },
  occurrence: { number: week },
  date: `${year}-10-${week === 8 ? "18" : "11"}T07:00Z`,
  ranks,
});
test("AP remains default if missing; Coaches never silently substitutes", () => {
  const p = collectPolls([poll("AFCA Coaches Poll")], 2026, 8, false, now);
  assert.equal(defaultPoll(p), "ap");
  assert.equal(p[0].teams.length, 0);
  assert.equal(p[0].status, "unavailable");
  assert.equal(p[1].teams.length, 1);
});
test("CFP is not yet published before announced first release; outage remains explicit for AP", () => {
  const p = collectPolls([], 2026, 8, true, now);
  assert.equal(p[2].status, "not_published");
  assert.equal(p[0].status, "unavailable");
  assert.match(p[0].message, /temporarily unavailable/);
});
test("a missing CFP edition after first release is unavailable, not a false publication claim", () => {
  assert.equal(
    collectPolls([], 2026, 11, false, new Date("2026-11-05"))[2].status,
    "unavailable",
  );
});
test("current season CFP is prioritized; prior season never is", () => {
  assert.equal(
    defaultPoll(
      collectPolls(
        [poll("AP Top 25"), poll("College Football Playoff", 8, 2025)],
        2026,
        8,
        false,
        now,
      ),
    ),
    "ap",
  );
  assert.equal(
    defaultPoll(
      collectPolls(
        [poll("AP Top 25"), poll("College Football Playoff")],
        2026,
        8,
        false,
        now,
      ),
    ),
    "cfp",
  );
});
test("each source retains its latest edition and reports an older edition; excludes FCS coaches", () => {
  const p = collectPolls(
    [
      poll("AP Top 25", 7),
      poll("AFCA Coaches Poll"),
      poll("FCS Coaches Poll", 8, 2026, [team("99", 1)]),
      poll("AFCA Division II Coaches Poll"),
    ],
    2026,
    8,
    false,
    now,
  );
  assert.equal(p[0].week, 7);
  assert.equal(p[0].status, "awaiting_update");
  assert.equal(p[1].teams[0].teamId, "1");
  assert.equal(p[2].teams.length, 0);
});
test("comparison includes union, handles unranked and unavailable separately, and excludes missing ranks from spread", () => {
  const p = collectPolls(
    [
      poll("AP Top 25", 8, 2026, [team("1", 2), team("2", 10)]),
      poll("AFCA Coaches Poll", 8, 2026, [team("1", 5), team("3", 12)]),
    ],
    2026,
    8,
    false,
    now,
  );
  const rows = comparisonRows(p);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].spread, 3);
  assert.equal(rows[0].ranks.cfp, null);
  assert.equal(rows.find((r) => r.team.teamId === "2")?.spread, null);
  assert.equal(rows.find((r) => r.team.teamId === "2")?.ranks.coaches, null);
  assert.equal(p[1].teams.length > 0, true);
  assert.equal(p[2].teams.length, 0);
});
test("future and invalid publication dates cannot masquerade as published rankings", () => {
  const p = collectPolls([
    poll("AP Top 25", 7),
    { ...poll("AP Top 25"), date: "2026-10-25T18:00Z" },
    { ...poll("AFCA Coaches Poll"), date: "invalid" },
  ], 2026, 8, false, now);
  assert.equal(p[0].week, 7);
  assert.equal(p[1].teams.length, 0);
});
