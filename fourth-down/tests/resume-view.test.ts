import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {runShadow,hash,candidates} from '../app/lib/playoff/engine.ts';import {resumeView} from '../app/lib/playoff/resume-view.ts';import {validFinal} from '../app/lib/playoff/ledger.ts';
const bytes=fs.readFileSync(new URL('./fixtures/resume-real-replay.json.gz',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'814f169cee531a5c9341bd34c1661a695fa059c6d3b540be6d70573e701c8b59');
const fixture=JSON.parse(gunzipSync(bytes).toString()),before=runShadow(fixture.before,candidates[0],false,null,'resume-shadow-v1.2.0'),after=runShadow(fixture.after,candidates[0],false,null,'resume-shadow-v1.2.0');
const clock='2026-10-26T22:00:00Z';
test('real archived 2025 results generate exact final explanations and indirect opponent effects',()=>{
 const untouched=hash([before,after]);const view=resumeView(after,before,clock);assert.equal(view.comparison,'comparable');
 const old=new Set(fixture.before.games.filter((g:any)=>validFinal(g,Date.parse(before.at))).map((g:any)=>g.id));const changed=fixture.after.games.filter((g:any)=>validFinal(g,Date.parse(after.at))&&!old.has(g.id));assert.ok(changed.length>20);
 for(const g of changed){for(const id of g.teams){const row=view.rows.find(r=>r.id===id);if(!row)continue;const reason=row.reasons.find(r=>r.kind==='result'&&r.gameIds.includes(g.id));assert.ok(reason);assert.ok(reason.text.includes(g.winner===id?'win':'loss'));}}
 assert.ok(view.rows.some(r=>r.reasons.some(e=>e.kind==='opponent')));
 // Every FBS team in this fortnight played: indirect effects are tested separately below.
 for(const row of view.rows)if(row.attribution&&row.scoreDelta!==null)assert.ok(Math.abs(row.attribution.resultAndLedger+row.attribution.pollAnchor-row.scoreDelta)<1e-8);
 assert.equal(hash([before,after]),untouched);assert.equal(view.projectedBracket,null);assert.equal(view.playoffProbabilities,null);
});
test('unchanged capture produces no movement and no invented explanation',()=>{const next=runShadow({...fixture.after,observedAt:'2025-10-19T07:22:16Z'},candidates[0],false,null,'resume-shadow-v1.2.0');const view=resumeView(next,after,clock);assert.equal(view.comparison,'comparable');assert.ok(view.rows.every(r=>r.movement===0&&r.reasons.length===0));});
test('poll-only change stays separate from confirmed-result movement and official poll arrows',()=>{const next=runShadow({...fixture.before,observedAt:fixture.after.observedAt,editions:fixture.after.editions},candidates[0],false,null,'resume-shadow-v1.2.0');const view=resumeView(next,before,clock);assert.ok(view.rows.some(r=>r.reasons.some(e=>e.kind==='poll')));assert.ok(view.rows.every(r=>r.reasons.every(e=>e.kind!=='result')));assert.ok(view.rows.every(r=>!r.attribution||Math.abs(r.attribution.resultAndLedger)<1e-8));for(const e of view.officialEditions){const raw=next.inputs.editions.find(x=>x.id===e.id&&x.date===e.date)!;assert.deepEqual(e.ranks.map(r=>r.rank),raw.ranks.map(r=>r.rank));}});
test('missing previous final and partial coverage withhold movement, complete records and live claims',()=>{const g=fixture.before.games.find((g:any)=>validFinal(g,Date.parse(before.at)));const input={...fixture.after,games:fixture.after.games.filter((x:any)=>x.id!==g.id)};const bad=runShadow(input,candidates[0],false,null,'resume-shadow-v1.2.0');const view=resumeView(bad,before,clock);assert.equal(view.comparison,'withheld');assert.ok(view.rows.every(r=>r.movement===null));assert.equal(view.rows.find(r=>r.id===g.teams[0])!.overall,null);assert.equal(view.liveScenario,null);assert.match(view.freshness,/archived/);const partial=resumeView(runShadow({...fixture.after,coverage:{complete:false,issues:['missing feed']}},candidates[0],false,null,'resume-shadow-v1.2.0'),before,clock);assert.ok(partial.rows.every(r=>r.resumePosition===null&&r.overall===null));});
test('model changes cannot create movement and a provisional snapshot cannot replace confirmed facts',()=>{assert.equal(resumeView(runShadow(fixture.after,candidates[1],false,null,'resume-shadow-v1.2.0'),before,clock).comparison,'withheld');assert.throws(()=>resumeView(runShadow(fixture.after,candidates[0],true,null,'resume-shadow-v1.2.0'),before,clock));});
test('simulated correction to a real-result fixture is a revision, not an extra win or removed loss',()=>{const g=fixture.after.games.find((g:any)=>g.teams.every((id:string)=>fixture.after.teams.some((t:any)=>t.id===id))&&validFinal(g,Date.parse(after.at)));const correction={...g,scores:[g.scores[1],g.scores[0]],winner:g.winner===g.teams[0]?g.teams[1]:g.teams[0],observedAt:'2025-10-19T07:23:16Z'};const revised=runShadow({...fixture.after,observedAt:correction.observedAt,games:[...fixture.after.games,correction]},candidates[0],false,null,'resume-shadow-v1.2.0');const view=resumeView(revised,after,clock);for(const id of g.teams){const row=view.rows.find(r=>r.id===id)!;assert.equal([...row.wins,...row.losses].filter(x=>x.gameId===g.id).length,1);assert.ok(row.reasons.some(x=>/Corrected final/.test(x.text)&&x.gameIds.includes(g.id)));}});

test('controlled replay of a real ASU–Texas Tech final changes other teams without inventing scores',()=>{const game=fixture.after.games.find((g:any)=>g.teams.includes('9')&&g.teams.includes('2641')&&validFinal(g,Date.parse(after.at)));assert.ok(game);const hypothetical=runShadow({...fixture.after,games:fixture.after.games.filter((g:any)=>g.id!==game.id)},candidates[0],false,null,'resume-shadow-v1.2.0');const view=resumeView(after,hypothetical,clock);assert.equal(view.comparison,'comparable');assert.ok(view.rows.some(r=>!game.teams.includes(r.id)&&r.movement!==null&&r.movement!==0));assert.ok(view.rows.some(r=>!game.teams.includes(r.id)&&r.reasons.some(e=>e.kind==='opponent'&&e.gameIds.includes(game.id))));});

test('historical replay never displays 2026 qualification rules as 2025 rules',()=>{const v=resumeView(after,before,clock);assert.match(v.championshipScenario.text,/Historical 2025/);assert.doesNotMatch(v.championshipScenario.text,/2026|Notre Dame/);});
test('unverified prior anchors and conflicting current records do not create confident movement',()=>{const prior=runShadow({...fixture.before,editions:[]},candidates[0],false,null,'resume-shadow-v1.2.0');assert.equal(resumeView(after,prior,clock).comparison,'withheld');const id=fixture.after.teams[0].id;const conflicting=runShadow({...fixture.after,teams:fixture.after.teams.map((t:any)=>({...t,...(t.id===id?{reportedRecord:'99-0'}:{})}))},candidates[0],false,null,'resume-shadow-v1.2.0');const view=resumeView(conflicting,before,clock);assert.equal(view.rows.find(r=>r.id===id)!.overall,null);assert.ok(view.rows.every(r=>r.resumePosition===null&&r.movement===null));assert.throws(()=>resumeView({...after,inputHash:'tampered'},before,clock));});
test('simulated fresh live scenario remains separate and stale/tied evidence cannot imply a winner',()=>{const g=fixture.after.games.find((g:any)=>g.teams.every((id:string)=>fixture.after.teams.some((t:any)=>t.id===id))&&validFinal(g,Date.parse(after.at)));const live={...g,state:'in',completed:false,winner:null,date:new Date(Date.parse(after.at)-3*3600000).toISOString(),period:4,clock:120,source:'simulated live-overlay regression; not a real live observation'};const input={...fixture.after,games:fixture.after.games.map((x:any)=>x.id===g.id?live:x)};const c=runShadow(input,candidates[0],false,null,'resume-shadow-v1.2.0');const v=resumeView(c,undefined,c.at);assert.ok(v.liveScenario);assert.equal(v.projectedBracket,null);const stored=hash(c);assert.equal(resumeView(c,undefined,new Date(Date.parse(c.at)+7*60000).toISOString()).liveScenario,null);assert.equal(hash(c),stored);const tied={...input,games:input.games.map((x:any)=>x.id===g.id?{...x,scores:[17,17]}:x)};const t=runShadow(tied,candidates[0],false,null,'resume-shadow-v1.2.0');assert.equal(resumeView(t,undefined,t.at).liveScenario,null);});


test('full archived universe has evidence for every changed score or position',()=>{
 const view=resumeView(after,before,clock);assert.equal(view.rows.length,136);
 for(const row of view.rows){
  if(row.movement!==0||Math.abs(row.scoreDelta??0)>0.000001)assert.ok(row.reasons.length,`${row.name}: unexplained change`);
  for(const reason of row.reasons)for(const id of reason.gameIds){
   const game=fixture.after.games.find((g:any)=>g.id===id&&validFinal(g,Date.parse(after.at)));
   assert.ok(game,`${row.name}: explanation references unconfirmed result ${id}`);
   if(reason.kind==='result')assert.ok(game.teams.includes(row.id));
  }
  assert.ok(row.attribution);assert.ok(Math.abs(row.attribution.resultAndLedger+row.attribution.pollAnchor-(row.scoreDelta??0))<1e-8);
 }
});
test('conflicting conference peer records withhold comparative standing without hiding verified own record',()=>{
 const team=fixture.after.teams.find((t:any)=>t.conference!=='18'&&fixture.after.teams.some((x:any)=>x.id!==t.id&&x.conference===t.conference));
 const peer=fixture.after.teams.find((t:any)=>t.id!==team.id&&t.conference===team.conference);
 const input={...fixture.after,teams:fixture.after.teams.map((t:any)=>t.id===peer.id?{...t,reportedRecord:'99-0'}:t)};
 const view=resumeView(runShadow(input,candidates[0],false,null,'resume-shadow-v1.2.0'),before,clock);
 const row=view.rows.find(r=>r.id===team.id)!;assert.ok(row.overall);assert.equal(row.conferencePosition,null);
 assert.equal(view.rows.find(r=>r.id===peer.id)!.overall,null);
});
