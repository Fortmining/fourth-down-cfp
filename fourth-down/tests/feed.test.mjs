import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as rankingModule from "../app/lib/rankings.ts";
const source = ts.transpileModule(
  fs.readFileSync("app/lib/live-feed.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
async function feed(scores, rankings, previous=rankings, future={}, now="2026-10-18T18:00Z") {
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) =>
      name.includes("rankings")
        ? rankingModule
        : {
            NextResponse: {
              json: (body, init) => ({ body, status: init?.status || 200 }),
            },
          },
    AbortSignal,
    URL,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return Date.parse(now); }
    },
    fetch: async (url) => {
      const week = new URL(url).searchParams.get("week");
      const v = url.includes("scoreboard") ? (week ? future[week] ?? scores : scores) : url.includes("weeks=")?previous:rankings;
      if (v instanceof Error) throw v;
      return { ok: true, json: async () => v };
    },
  });
  return exports.loadLiveFeed();
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
  assert.ok(r.body.warnings.some(w => w.startsWith("Ranking feed")));
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

test("malformed feed objects degrade like provider failures", async () => {
  const r = await feed({ unexpected: [] }, { rankings: [poll] });
  assert.equal(r.status, 200);
  assert.equal(r.body.games.length, 0);
  assert.ok(r.body.warnings.includes("Scores are temporarily unavailable."));
  assert.equal((await feed({}, {})).status, 503);
});

const event = (id, date, state="pre", timeValid=true) => ({
 id, date, name: id, status: {type: {state, shortDetail: state}},
 competitions: [{timeValid, competitors: []}],
});
const saturday = event("finished", "2026-10-17T20:00Z", "post");
const next = event("next-week", "2026-10-20T23:00Z");
const later = event("later-week", "2026-10-31T16:00Z", "pre", false);
const weeklyScores = {season: {year: 2026}, week: {number: 7}, events: [saturday],
 leagues: [{calendar: [{value: "2", entries: [
  {value: "7", startDate: "2026-10-12T07:00Z"},
  {value: "8", startDate: "2026-10-19T07:00Z"},
  {value: "9", startDate: "2026-10-26T07:00Z"},
 ]}]}]};
test("Saturday-to-Sunday rollover retains finals and includes the next two schedule periods", async()=>{
 for (const now of ["2026-10-17T23:00Z", "2026-10-18T18:00Z"]) {
  const r=await feed(weeklyScores, {rankings:[poll]}, undefined, {
   8: {events:[next, {...saturday,status:{type:{state:"pre"}},date:"2026-10-20T23:00Z"}]},
   9: {events:[later]},
  },now);
  assert.equal(r.body.games.length,3);
  assert.equal(r.body.games.find(g=>g.id==="finished").status,"post");
  assert.equal(r.body.games.filter(g=>g.status==="pre").length,2);
  assert.equal(r.body.games.find(g=>g.id==="later-week").kickoffTbd,true);
  assert.equal(r.body.scheduleComplete,true);
 }
});
test("future schedule outage retains completed games and gives an explicit warning",async()=>{
 const r=await feed(weeklyScores,{rankings:[poll]},undefined,{8:new Error("secret"),9:{events:[]}});
 assert.equal(r.status,200);assert.equal(r.body.games.length,1);
 assert.equal(r.body.scheduleComplete,false);
 assert.ok(r.body.warnings.some(w=>w.startsWith("Upcoming schedule")));
 assert.equal(JSON.stringify(r.body).includes("secret"),false);
});
test("calendar follows postseason type instead of assuming another regular-season week",async()=>{
 const scores={...weeklyScores,leagues:[{calendar:[{value:"3",entries:[
  {value:"1",startDate:"2026-12-13T08:00Z"},{value:"999",startDate:"2026-12-18T08:00Z"},
 ]}]}]};
 const r=await feed(scores,{rankings:[poll]},undefined,{1:{events:[]}},"2026-12-12T18:00Z");
 assert.equal(r.body.schedulePeriods.length,1);assert.equal(r.body.schedulePeriods[0].type,3);
});
