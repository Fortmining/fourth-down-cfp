import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {runShadow,candidates} from '../app/lib/playoff/engine.ts';import {fanResume} from '../app/lib/playoff/fan-resume.ts';
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/resume-real-replay.json.gz',import.meta.url))).toString());
const score=(input:any)=>runShadow(input,candidates[0],false,null,'resume-shadow-v1.2.0');const before=score(f.before),after=score(f.after),clock='2026-10-27T12:00:00Z';
test('fan evidence and remaining games reconcile to versioned archived inputs',()=>{
 const view=fanResume(after,before,clock);assert.ok(view.reviewTeams.some(t=>t.id==='2633'));assert.equal(view.reviewTeams.length,5);
 for(const row of view.rows){assert.ok(row.strengths.length);assert.ok(row.weaknesses.length);for(const game of row.remaining){const raw=after.inputs.games.find(g=>g.id===game.gameId)!;assert.ok(raw);assert.ok(Date.parse(raw.date)>Date.parse(after.at));assert.equal(raw.state,'pre');assert.ok(raw.teams.includes(row.id));assert.equal(raw.completed,false);} }
 assert.ok(view.reviewTeams.find(t=>t.label==='Improving résumé'));assert.ok(view.reviewTeams.find(t=>t.label==='Declining résumé'));assert.equal(view.projectedBracket,null);assert.equal(view.playoffProbabilities,null);
});
test('missing future schedule is explicitly partial and never filled from a later vintage',()=>{
 const input={...f.before,games:f.before.games.filter((g:any)=>g.state!=='pre'),coverage:{...f.before.coverage,futureComplete:false}};
 const view=fanResume(score(input),undefined,clock);assert.ok(view.rows.every(r=>r.remaining.length===0&&/incomplete/.test(r.scheduleLabel)));assert.equal(view.comparison,'baseline only');assert.ok(!view.reviewTeams.some(t=>/Improving|Declining/.test(t.label)));
});
test('unverified complete records do not produce a confident win-rate summary',()=>{
 const view=fanResume(score({...f.after,coverage:{complete:false,futureComplete:false,issues:['incomplete feed']}}),before,clock);
 assert.ok(view.rows.every(r=>r.overall===null&&r.movement===null));assert.ok(view.rows.every(r=>r.strengths.every(s=>!/Unbeaten|confirmed wins;/.test(s))));
});
