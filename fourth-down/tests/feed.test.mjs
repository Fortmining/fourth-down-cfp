import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as rankingModule from "../app/lib/rankings.ts";
const source = ts.transpileModule(
  fs.readFileSync("app/api/live/route.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
async function feed(scores, rankings, previous=rankings) {
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) =>
      name.includes("lib/rankings")
        ? rankingModule
        : {
            NextResponse: {
              json: (body, init) => ({ body, status: init?.status || 200 }),
            },
          },
    AbortSignal,
    fetch: async (url) => {
      const v = url.includes("scoreboard") ? scores : url.includes("weeks=")?previous:rankings;
      if (v instanceof Error) throw v;
      return { ok: true, json: async () => v };
    },
  });
  return exports.GET();
}
const poll = {
  name: "AFCA Coaches Poll",
  season: { year: 2026 },
  date: "2026-10-18",
  ranks: [
    {
      current: 1,
      previous: 3,
      recordSummary: "6-0",
      team: {
        id: 2390,
        location: "Miami",
        name: "Hurricanes",
        groups: { shortName: "ACC" },
      },
    },
  ],
};
test("normalizes full team names, records, movement and current-season poll", async () => {
  const r = await feed(
    { season: { year: 2026 }, events: [] },
    {
      rankings: [
        { ...poll, name: "College Football Playoff", season: { year: 2025 } },
        poll,
      ],
    },
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.rankingSource, null);
  const coaches = r.body.polls.find((p) => p.id === "coaches");
  assert.equal(coaches.teams[0].name, "Miami Hurricanes");
  assert.equal(coaches.teams[0].record, "6-0");
  assert.equal(r.body.isCommitteeRanking, false);
});
test("scores survive a ranking outage", async () => {
  const r = await feed({ season: { year: 2026 }, events: [] }, new Error());
  assert.equal(r.status, 200);
  assert.equal(r.body.warnings.length, 1);
  assert.equal(r.body.rankings.length, 0);
});
test("rankings survive a scoreboard outage", async () => {
  const r = await feed(new Error(), { rankings: [poll] });
  assert.equal(r.status, 200);
  assert.equal(r.body.polls.find((p) => p.id === "coaches").teams.length, 1);
  assert.equal(r.body.warnings[0], "Scores are temporarily unavailable.");
});
test("total outage returns a clean 503 without provider internals", async () => {
  const r = await feed(new Error("secret"), new Error("secret"));
  assert.equal(r.status, 503);
  assert.ok(r.body.error);
  assert.equal(JSON.stringify(r).includes("secret"), false);
});

test("a newer Coaches release retains the prior AP edition without relabeling it",async()=>{
 const r=await feed({season:{year:2026},events:[]},{latestWeek:{number:8},rankings:[{...poll,occurrence:{number:8}}]},{rankings:[{...poll,name:"AP Top 25",date:"2026-10-11",occurrence:{number:7}}]});
 assert.equal(r.body.defaultRankingSource,"ap");assert.equal(r.body.rankingSource,"AP Top 25");assert.equal(r.body.polls.find(p=>p.id==="ap").status,"awaiting_update");assert.equal(r.body.polls.find(p=>p.id==="coaches").week,8);assert.equal(r.body.outlook.inputSource,"ap");
});
