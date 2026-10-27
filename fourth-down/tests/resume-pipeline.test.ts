import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {hash} from '../app/lib/playoff/engine.ts';import {ResumePipeline,pipelineLimits,type SourceCapture,type PipelineState} from '../app/lib/playoff/resume-pipeline.ts';import {FileResumeStore} from '../app/lib/playoff/file-resume-store.ts';import {captureResumeUpdate} from '../app/lib/playoff/resume-source.ts';import type {Inputs,GameRevision} from '../app/lib/playoff/types';
const epoch=Date.parse('2026-10-27T13:00:00Z'),iso=(n:number)=>new Date(n).toISOString();
function seed():Inputs{
 const teams=Array.from({length:26},(_,k)=>({id:String(k+1),name:'Controlled test team '+(k+1),conference:'8',eligible:null}));
 const game=(id:number,a:number,b:number,final:boolean):GameRevision=>({id:String(id),season:2026,date:final?'2026-10-20T12:00:00Z':'2026-10-27T12:00:00Z',state:final?'post':'pre',completed:final,teams:[String(a),String(b)],scores:final?[28,14]:[null,null],winner:final?String(a):null,conferenceGame:true,period:final?4:null,clock:final?0:null,observedAt:iso(epoch),source:'Controlled offline replay, not real events'});
 return {season:2026,observedAt:iso(epoch),teams,games:[...Array.from({length:13},(_,k)=>game(k+1,k*2+1,k*2+2,true)),...Array.from({length:13},(_,k)=>game(k+101,k*2+1,k*2+2,false))],editions:[{id:'ap',season:2026,date:'2026-10-25T07:00:00Z',ranks:teams.slice(0,25).map((t,k)=>({id:t.id,rank:k+1,previous:k+1,record:'poll snapshot unchanged'}))}],coverage:{complete:true,futureComplete:true,issues:[]},rulesVersion:'cfp-2026-unverified-conference-adapters'};
}
function advance(input:Inputs,at:number,ids:string[]=[]):Inputs{const i=structuredClone(input);i.observedAt=iso(at);for(const id of ids){const g=i.games.find(g=>g.id===id)!;Object.assign(g,{state:'post',completed:true,scores:[17,24],winner:g.teams[1],observedAt:iso(at),period:4,clock:0});}return i;}
const capture=(i:Inputs):SourceCapture=>({inputs:i,receivedAt:i.observedAt,sourceHashes:{controlled:hash(i)},notes:['Simulated replay, not a source delivery claim']});
function setup(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fd-private-pipeline-')),store=new FileResumeStore(dir);let next=capture(seed());const source={read:async()=>structuredClone(next)};return {dir,store,source,pipeline:new ResumePipeline(store,source,()=>0),set:(i:Inputs)=>{next=capture(i);}};}
async function state(store:FileResumeStore){return store.transaction(s=>s);}

test('confirmed final flows through source, atomic history, records, explanations and cached display',async()=>{
 const x=setup();try{assert.equal((await x.pipeline.tick(epoch)).status,'updated');const a=advance(seed(),epoch+240000,['101']);x.set(a);assert.equal((await x.pipeline.tick(epoch+240000)).status,'updated');const d:any=await x.pipeline.display(epoch+240000);assert.equal(d.revision,2);assert.equal(d.history.length,2);assert.equal(d.view.rows.find((r:any)=>r.id==='1').overall,'1-1');assert.equal(d.view.rows.find((r:any)=>r.id==='2').overall,'1-1');assert.ok(d.view.rows.find((r:any)=>r.id==='1').reasons.some((r:any)=>r.gameIds.includes('101')));assert.equal(d.view.officialEditions[0].ranks[0].rank,1);assert.equal(d.view.projectedBracket,null);assert.equal(d.actualRedisCommands,0);
 const before=(await state(x.store)).daily.cacheMisses;await x.pipeline.display(epoch+240001);assert.equal((await state(x.store)).daily.cacheMisses,before);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('consecutive and simultaneous finals recalculate all teams and preserve ordered comparison context',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);let i=advance(seed(),epoch+240000,['101']);x.set(i);await x.pipeline.tick(epoch+240000);i=advance(i,epoch+480000,['102','103']);x.set(i);await x.pipeline.tick(epoch+480000);const d:any=await x.pipeline.display(epoch+480000);assert.deepEqual(d.history.map((h:any)=>h.at),[iso(epoch),iso(epoch+240000),iso(epoch+480000)]);assert.equal(d.view.previousAt,iso(epoch+240000));assert.ok(d.view.rows.find((r:any)=>r.id==='3').reasons.some((r:any)=>r.gameIds.includes('102')));assert.ok(d.view.rows.find((r:any)=>r.id==='5').reasons.some((r:any)=>r.gameIds.includes('103')));assert.equal(d.view.rows.length,26);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('unchanged, later observations and live clocks never generate duplicate confirmed history',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);const i=advance(seed(),epoch+240000);for(const g of i.games)g.observedAt=i.observedAt;Object.assign(i.games.find(g=>g.id==='101')!,{state:'in',scores:[7,3],period:2,clock:40});x.set(i);assert.equal((await x.pipeline.tick(epoch+240000)).status,'unchanged');assert.equal((await state(x.store)).history.length,1);const restarted=new ResumePipeline(new FileResumeStore(x.dir),x.source);assert.equal((await restarted.tick(epoch+240000)).status,'unchanged');assert.equal((await state(x.store)).history.length,1);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('stale, delayed, missing-final and conflicting records preserve confirmed head and withhold movement',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);for(const mutate of [(i:Inputs)=>{i.observedAt=iso(epoch-600001);},(i:Inputs)=>{i.games.shift();},(i:Inputs)=>{i.teams[0].reportedRecord='99-0';},(i:Inputs)=>{i.coverage.complete=false;},(i:Inputs)=>{i.games[0].scores=[null,null];},(i:Inputs)=>{i.games.push(structuredClone(i.games[0]));}]){
 const i=advance(seed(),epoch+240000);mutate(i);x.set(i);const r=await x.pipeline.tick(epoch+240000);assert.equal(r.updated,false);const d:any=await x.pipeline.display(epoch+240000);assert.equal(d.revision,1);assert.equal(d.status,'withheld');assert.ok(d.view.rows.every((r:any)=>r.movement===null));}
 x.set(advance(seed(),epoch+480000));assert.equal((await x.pipeline.tick(epoch+480000)).status,'unchanged');assert.equal((await x.pipeline.display(epoch+480000) as any).status,'ready');
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('cache expiration refreshes stored view; source staleness withholds movement even after restart',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);await x.pipeline.display(epoch);const d:any=await x.pipeline.display(epoch+pipelineLimits.sourceAgeMs+1);assert.equal(d.status,'withheld');assert.ok(d.view.rows.every((r:any)=>r.movement===null));const restart=new ResumePipeline(new FileResumeStore(x.dir),x.source);assert.equal((await restart.display(epoch+pipelineLimits.sourceAgeMs+1) as any).status,'withheld');
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('published editions are immutable and newer editions remain separate from result evidence',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);const bad=advance(seed(),epoch+240000);bad.editions[0].ranks[0].previous=5;x.set(bad);assert.equal((await x.pipeline.tick(epoch+240000)).status,'withheld');const good=advance(seed(),epoch+480000);good.editions.push({...structuredClone(good.editions[0]),date:iso(epoch+240000)});x.set(good);assert.equal((await x.pipeline.tick(epoch+480000)).status,'updated');assert.equal((await state(x.store)).history.length,2);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('before-commit interruption rolls back history/cache; after-commit lost acknowledgement deduplicates retry',async()=>{
 for(const phase of ['before-rename','after-rename'] as const){const x=setup();try{await x.pipeline.tick(epoch);const i=advance(seed(),epoch+240000,['101']);x.set(i);let calls=0;const broken=new FileResumeStore(x.dir,p=>{if(p===phase&&++calls===2){throw Error('Controlled interrupted transaction');}});const p=new ResumePipeline(broken,x.source);await p.tick(epoch+240000);assert.equal((await state(x.store)).history.length,phase==='before-rename'?1:2);const restart=new ResumePipeline(new FileResumeStore(x.dir),x.source);await restart.tick(epoch+240000);assert.equal((await state(x.store)).history.length,2);assert.equal((await restart.display(epoch+240000) as any).view.rows.find((r:any)=>r.id==='1').overall,'1-1');
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}}
});
test('durable day/month limits survive restart and deny work before source access',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);await x.store.transaction(s=>{s.daily.ticks=pipelineLimits.dayTicks;});let calls=0;const p=new ResumePipeline(new FileResumeStore(x.dir),{read:async()=>{calls++;return capture(seed());}});assert.equal((await p.tick(epoch+1)).status,'budget-withheld');assert.equal(calls,0);await x.store.transaction(s=>{s.daily.cacheMisses=pipelineLimits.dayCacheMisses;});assert.equal((await p.display(epoch+1) as any).status,'unavailable');assert.equal((await state(x.store)).history.length,1);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('corrupt persisted state fails closed without fabricated display or source work',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);const raw=JSON.parse(fs.readFileSync(x.store.file,'utf8'));raw.state.revision=999;fs.writeFileSync(x.store.file,JSON.stringify(raw));assert.equal((await x.pipeline.display(epoch) as any).view,null);assert.equal((await x.pipeline.tick(epoch)).status,'failed');
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('ESPN adapter applies a confirmed final, derives records when old aggregates predate it, and ignores regression',()=>{
 const i=seed();i.teams[0].reportedRecord='1-0';i.teams[0].reportedConferenceRecord='1-0';const raw={id:'101',date:i.games.find(g=>g.id==='101')!.date,status:{type:{state:'post',completed:true},period:4,clock:0},competitions:[{competitors:[{team:{id:'1'},score:'17',winner:false},{team:{id:'2'},score:'24',winner:true}]}]};
 const c=captureResumeUpdate(i,{season:{year:2026},events:[raw]},iso(epoch+240000));assert.equal(c.inputs.teams[0].reportedRecord,undefined);assert.ok(c.notes?.some(n=>n.includes('Aggregate record not refreshed')));const late=structuredClone(raw);late.status.type.state='pre';late.status.type.completed=false;const d=captureResumeUpdate(c.inputs,{season:{year:2026},events:[late]},iso(epoch+480000));assert.equal(d.inputs.games.find(g=>g.id==='101')!.state,'post');assert.ok(d.notes?.some(n=>n.includes('regression')));assert.throws(()=>captureResumeUpdate(i,{season:{year:2025},events:[]},iso(epoch)));
});

test('retention evicts oldest receipts without losing immediate comparison or ordering',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);let i=seed();for(let n=1;n<=34;n++){i=advance(i,epoch+n*1000);i.pendingGames=[{id:'pending',name:'Controlled schedule revision '+n,date:'2026-12-01T00:00:00Z',knownTeamIds:[],observedAt:i.observedAt,source:'Controlled offline revision'}];x.set(i);assert.equal((await x.pipeline.tick(epoch+n*1000)).status,'updated');}const d:any=await x.pipeline.display(epoch+34000);assert.equal(d.history.length,32);assert.equal(d.history[0].at,iso(epoch+3000));assert.equal(d.view.previousAt,iso(epoch+33000));
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('overlapping private workers cannot replace a newer head with an older source result',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);let release!:(c:SourceCapture)=>void;let entered!:()=>void;const waiting=new Promise<void>(r=>{entered=r;});const older=new ResumePipeline(x.store,{read:async()=>{entered();return await new Promise<SourceCapture>(r=>{release=r;});}});const pending=older.tick(epoch+240000);await waiting;x.set(advance(seed(),epoch+480000,['101','102']));await x.pipeline.tick(epoch+480000);release(capture(advance(seed(),epoch+240000,['101'])));assert.equal((await pending).status,'superseded');assert.equal((await state(x.store)).history.length,2);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('fresh conflicting standings and participant/conference mismatches do not alter the confirmed head',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);for(const change of [(i:Inputs)=>{i.teams[0].conference='5';},(i:Inputs)=>{i.games[0].teams.reverse();i.games[0].scores.reverse();},(i:Inputs)=>{i.editions[0].date='2026-10-24T07:00:00Z';}]){const i=advance(seed(),epoch+240000);change(i);x.set(i);assert.equal((await x.pipeline.tick(epoch+240000)).updated,false);assert.equal((await state(x.store)).history.length,1);}
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('genuine archived before/after captures reproduce saved model movement without rewriting polls',async()=>{
 const {gunzipSync}=await import('node:zlib');const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/resume-real-replay.json.gz',import.meta.url))).toString());const x=setup();try{x.set(fixture.before);assert.equal((await x.pipeline.tick(Date.parse(fixture.before.observedAt))).status,'updated');x.set(fixture.after);const update=await x.pipeline.tick(Date.parse(fixture.after.observedAt));assert.equal(update.status,'updated');const d:any=await x.pipeline.display(Date.parse(fixture.after.observedAt));assert.equal(d.view.rows.find((r:any)=>r.id==='87').movement,28);assert.equal(d.view.rows.find((r:any)=>r.id==='2633').overall,'5-2');assert.equal(d.view.previousAt,fixture.before.observedAt);assert.ok(d.view.rows.filter((r:any)=>r.reasons.length).length>100);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('hot-cache visitors are throttled without unbounded store calls or response bytes',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);let denied=0;for(let n=0;n<70;n++){const d:any=await x.pipeline.display(epoch);if(d.status==='rate-limited')denied++;}assert.ok(denied>=10);assert.equal((await state(x.store)).daily.cacheMisses,1);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('weekend operating assumptions expose unknown baselines and excessive demand rather than approving activation',async()=>{
 const {resumeOperatingPlan}=await import('../app/lib/playoff/resume-operating-plan.ts');const common={updatesPerWeek:70,wireBytesPerMiss:68020,cpuMsPerUpdate:323.325,cpuMsPerUnchangedTick:20,ledgerBytesPerEntry:26836,baselineCommandsPerMonth:null,baselineBandwidthBytesPerMonth:null,physicalStorageMeasured:false,completeUsageDays:5};const normal=resumeOperatingPlan({...common,cacheMissesPerDay:100}),heavy=resumeOperatingPlan({...common,cacheMissesPerDay:10000});assert.ok(normal.illustrativeCommandsPer30Days>100000);assert.equal(normal.freshnessCommandsPerDay,10080);assert.ok(normal.issues.some(i=>i.includes('monthly work budget')));assert.ok(normal.issues.some(i=>i.includes('baseline')));assert.ok(heavy.illustrativeBandwidthBytes>10_000_000_000);assert.ok(heavy.issues.some(i=>i.includes('budget')));assert.equal(normal.productionActivationPermitted,false);
});

test('display cannot leak a later snapshot through a hot cache to an earlier as-of clock',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);await x.pipeline.display(epoch);const d:any=await x.pipeline.display(epoch-1);assert.equal(d.view,null);assert.equal(d.status,'unavailable');}finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('source timeout aborts and cannot commit after a late source resolution',async()=>{
 const x=setup();try{let wasAborted=false;const p=new ResumePipeline(x.store,{read:async signal=>await new Promise<SourceCapture>(resolve=>{signal.addEventListener('abort',()=>{wasAborted=true;resolve(capture(seed()));},{once:true});})});const r=await p.tick(epoch);assert.equal(r.updated,false);assert.equal(wasAborted,true);assert.equal((await state(x.store)).history.length,0);}finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('elapsed work deadline stops the update before committing a model',async()=>{
 const x=setup();try{let calls=0;const p=new ResumePipeline(x.store,x.source,()=>calls++?pipelineLimits.deadlineMs+1:0);assert.equal((await p.tick(epoch)).status,'budget-withheld');assert.equal((await state(x.store)).history.length,0);}finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('an expired official anchor or overdue unconfirmed fixture cannot remain a ready ordering',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);for(const change of [(i:Inputs)=>{i.editions[0].date='2026-10-01T07:00:00Z';},(i:Inputs)=>{i.games.find(g=>g.id==='101')!.date='2026-10-20T00:00:00Z';}]){const i=advance(seed(),epoch+240000);change(i);x.set(i);assert.equal((await x.pipeline.tick(epoch+240000)).status,'withheld');assert.equal((await state(x.store)).history.length,1);}
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('validated unchanged ticks renew the hot cache without model history or visitor-store amplification',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);await x.pipeline.display(epoch);for(let n=1;n<10;n++){x.set(advance(seed(),epoch+n*240000));assert.equal((await x.pipeline.tick(epoch+n*240000)).status,'unchanged');assert.equal((await x.pipeline.display(epoch+n*240000) as any).status,'ready');}const d=await state(x.store);assert.equal(d.history.length,1);assert.equal(d.daily.cacheMisses,1);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('already-checked unchanged captures skip all model/store work; confirmed changes enter the private coordinator',async()=>{
 const {confirmedResumeHandoff,confirmedResumeSignature}=await import('../app/lib/playoff/resume-trigger.ts');const x=setup();try{const i=seed(),later=advance(i,epoch+240000);let calls=0;const original=x.pipeline.tick.bind(x.pipeline);x.pipeline.tick=async now=>{calls++;return original(now);};assert.equal((await confirmedResumeHandoff(x.pipeline,i,later,epoch+240000,{signature:confirmedResumeSignature(i),status:'ready',checkedAt:iso(epoch+240000)})).status,'no-confirmed-change');assert.equal(calls,0);const final=advance(i,epoch+240000,['101']);x.set(final);assert.equal((await confirmedResumeHandoff(x.pipeline,i,final,epoch+240000)).updated,true);assert.equal(calls,1);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('existing fresh-feed handoff skips unchanged polls/live scores without a scheduler or extra source request',async()=>{
 const {verifiedFeedResumeGate}=await import('../app/lib/playoff/resume-trigger.ts');const trace={policy:'no-store',ok:true,responseReceivedAt:iso(epoch),ageSeconds:null};const feed={season:2026,updatedAt:iso(epoch),scoreboardAvailable:true,sourceFetch:{scoreboard:trace,rankings:trace},games:[],polls:[]};assert.equal(verifiedFeedResumeGate(feed,structuredClone(feed),epoch,true,iso(epoch)),'no-confirmed-change');const final={...feed,games:[{id:'101',date:iso(epoch-3600000),status:'post',providerStatus:'STATUS_FINAL',completed:true,teams:[{id:'1',score:'17'},{id:'2',score:'24'}]}]};assert.equal(verifiedFeedResumeGate(feed,final,epoch),'refresh');assert.equal(verifiedFeedResumeGate(feed,{...final,sourceFetch:{...feed.sourceFetch,scoreboard:{...trace,ageSeconds:120}}},epoch),'withheld');assert.equal(verifiedFeedResumeGate(feed,final,epoch+360001),'withheld');
});

test('historical views use the selected retained update and its actual predecessor, never an arbitrary fallback',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);const first=(await state(x.store)).history[0].id;x.set(advance(seed(),epoch+240000,['101']));await x.pipeline.tick(epoch+240000);const second=(await state(x.store)).history[1].id;const old:any=await x.pipeline.historyView(first,epoch+240000),recent:any=await x.pipeline.historyView(second,epoch+240000);assert.equal(old.status,'archived');assert.equal(old.view.comparison,'baseline only');assert.equal(recent.view.previousAt,iso(epoch));assert.ok(recent.view.rows.find((r:any)=>r.id==='1').reasons.some((r:any)=>r.gameIds.includes('101')));assert.equal((await x.pipeline.historyView('0'.repeat(64),epoch+240000)).view,null);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('a failed or interrupted engine update is retried even after the source feed stops changing',async()=>{
 const {confirmedResumeHandoff,confirmedResumeSignature}=await import('../app/lib/playoff/resume-trigger.ts');const x=setup();try{await x.pipeline.tick(epoch);const final=advance(seed(),epoch+240000,['101']);x.set(final);const old=confirmedResumeSignature(seed());assert.equal((await confirmedResumeHandoff(x.pipeline,final,final,epoch+240000,{signature:old,status:'ready'})).status,'updated');const ack=(await state(x.store)).sourceSignature;assert.equal((await confirmedResumeHandoff(x.pipeline,final,final,epoch+240000,{signature:ack,status:'ready',checkedAt:iso(epoch+240000)})).status,'no-confirmed-change');assert.equal((await state(x.store)).history.length,2);}finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('embedded poll records can refresh without rewriting a published ranking snapshot or creating false movement',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);const i=advance(seed(),epoch+240000);i.editions[0].ranks[0].record='updated aggregate, not a new poll';x.set(i);assert.equal((await x.pipeline.tick(epoch+240000)).status,'unchanged');const d:any=await x.pipeline.display(epoch+240000);assert.equal(d.view.officialEditions[0].date,seed().editions[0].date);assert.equal((await state(x.store)).history.length,1);}finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('a withheld committed head is revalidated instead of being skipped as an unchanged successful update',async()=>{
 const {confirmedResumeHandoff}=await import('../app/lib/playoff/resume-trigger.ts');const x=setup();try{await x.pipeline.tick(epoch);await x.store.transaction(s=>{s.status='withheld';});const i=advance(seed(),epoch+240000);x.set(i);const ack=(await state(x.store)).sourceSignature;assert.equal((await confirmedResumeHandoff(x.pipeline,i,i,epoch+240000,{signature:ack,status:'withheld'})).status,'unchanged');assert.equal((await state(x.store)).status,'ready');assert.equal((await state(x.store)).history.length,1);}finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('a stale worker CAS failure cannot mark a newer independently committed head withheld',async()=>{
 const x=setup();try{await x.pipeline.tick(epoch);const old=advance(seed(),epoch+240000,['101']),newer=advance(seed(),epoch+480000,['101','102']);const fresh=new ResumePipeline(x.store,{read:async()=>capture(newer)},()=>0);let calls=0;const wrapped={transaction:async<T>(fn:(s:PipelineState)=>T)=>{if(++calls===2){await fresh.tick(epoch+480000);throw Error('Controlled stale CAS');}return x.store.transaction(fn);}};const stale=new ResumePipeline(wrapped,{read:async()=>capture(old)},()=>0);assert.equal((await stale.tick(epoch+240000)).status,'failed');const stateAfter=await state(x.store);assert.equal(stateAfter.status,'ready');assert.equal(stateAfter.revision,2);assert.equal(stateAfter.checkedAt,newer.observedAt);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

test('the captured complete 2026 universe reaches the same private pipeline with current Tennessee records',async()=>{
 const {benchmarkFixtureBase64}=await import('../app/lib/playoff/benchmark-fixture.ts');const {gunzipSync}=await import('node:zlib');const input=JSON.parse(gunzipSync(Buffer.from(benchmarkFixtureBase64,'base64')).toString());const x=setup();try{x.set(input);assert.equal((await x.pipeline.tick(Date.parse(input.observedAt))).status,'updated');const d:any=await x.pipeline.display(Date.parse(input.observedAt));assert.equal(d.view.season,2026);assert.equal(d.view.rows.length,138);const t=d.view.rows.find((r:any)=>r.id==='2633');assert.equal(t.overall,'6-2');assert.equal(t.conferenceRecord,'3-2');assert.equal(d.view.projectedBracket,null);assert.equal(d.view.playoffProbabilities,null);}finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});

// Simulations: no new real events or production calls.
test('inactive handoffs renew saved freshness without creating duplicate history',async()=>{
 const {confirmedResumeHandoff}=await import('../app/lib/playoff/resume-trigger.ts');const x=setup();
 try{await x.pipeline.tick(epoch);for(let n=1;n<=4;n++){
  const at=epoch+n*240000,i=advance(seed(),at),checkpoint=await state(x.store);x.set(i);
  assert.equal((await confirmedResumeHandoff(x.pipeline,i,i,at,{signature:checkpoint.sourceSignature,status:checkpoint.status,checkedAt:checkpoint.checkedAt})).status,'unchanged');
  const d:any=await x.pipeline.display(at);assert.equal(d.status,'ready');assert.equal(d.checkedAt,iso(at));
 }assert.equal((await state(x.store)).history.length,1);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('missing, future or expired freshness proof cannot skip revalidation',async()=>{
 const {confirmedResumeHandoff,confirmedResumeSignature}=await import('../app/lib/playoff/resume-trigger.ts');const x=setup();
 try{await x.pipeline.tick(epoch);const i=advance(seed(),epoch+480000);x.set(i);
 for(const checkedAt of [undefined,iso(epoch),iso(epoch+480001),'invalid']){
  assert.equal((await confirmedResumeHandoff(x.pipeline,i,i,epoch+480000,{signature:confirmedResumeSignature(i),status:'ready',checkedAt})).status,'unchanged');
 }assert.equal((await state(x.store)).history.length,1);
 }finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
test('feed equality without a saved current freshness receipt cannot bypass the engine',async()=>{
 const {verifiedFeedResumeGate}=await import('../app/lib/playoff/resume-trigger.ts');const trace={policy:'no-store',ok:true,responseReceivedAt:iso(epoch),ageSeconds:null};const feed={season:2026,updatedAt:iso(epoch),scoreboardAvailable:true,sourceFetch:{scoreboard:trace,rankings:trace},games:[],polls:[]};
 for(const checkedAt of [undefined,iso(epoch-240000),iso(epoch+1)])assert.equal(verifiedFeedResumeGate(feed,feed,epoch,true,checkedAt),'refresh');
});
test('confirmed handoff identity includes schedule corrections and unresolved fixture evidence',async()=>{
 const {confirmedResumeSignature}=await import('../app/lib/playoff/resume-trigger.ts');const a=seed(),b=structuredClone(a);b.games.at(-1)!.date='2026-10-28T12:00:00Z';assert.notEqual(confirmedResumeSignature(a),confirmedResumeSignature(b));
 const c=structuredClone(a);c.pendingGames=[{id:'slot',name:'Verified championship slot',date:'2026-12-05T00:00:00Z',knownTeamIds:[],observedAt:c.observedAt,source:'Controlled fixture evidence'}];assert.notEqual(confirmedResumeSignature(a),confirmedResumeSignature(c));
});

test('operating admission includes inactive freshness ticks and retained archive transfer',async()=>{
 const {resumeOperatingPlan}=await import('../app/lib/playoff/resume-operating-plan.ts');const o={updatesPerWeek:70,cacheMissesPerDay:100,wireBytesPerMiss:58260,cpuMsPerUpdate:323.325,cpuMsPerUnchangedTick:20,ledgerBytesPerEntry:26836,baselineCommandsPerMonth:null,baselineBandwidthBytesPerMonth:null,physicalStorageMeasured:false,completeUsageDays:5,compressedStateBytes:756628};
 const plan=resumeOperatingPlan(o);assert.equal(plan.freshnessCommandsPerDay,10080);assert.ok(plan.peakDayCommands>5000);assert.ok(plan.illustrativeBandwidthBytes>30_000_000_000);assert.equal(plan.bandwidthIsLowerBound,false);assert.equal(plan.productionActivationPermitted,false);
 const inactive=resumeOperatingPlan({...o,updatesPerWeek:0,cacheMissesPerDay:0});assert.equal(inactive.illustrativeCommandsPer30Days,302400);assert.ok(inactive.issues.some(i=>i.includes('daily candidate budget')));
});

test('compact freshness has a bounded candidate scenario and exposes excessive misses',async()=>{
 const {resumeOperatingPlan}=await import('../app/lib/playoff/resume-operating-plan.ts');const o={updatesPerWeek:70,cacheMissesPerDay:50,wireBytesPerMiss:58260,cpuMsPerUpdate:323.325,cpuMsPerUnchangedTick:20,ledgerBytesPerEntry:26836,baselineCommandsPerMonth:null,baselineBandwidthBytesPerMonth:null,physicalStorageMeasured:false,completeUsageDays:5,compressedStateBytes:756628,freshnessProtocol:'compact' as const};const plan=resumeOperatingPlan(o);
 assert.ok(plan.illustrativeCommandsPer30Days<100000);assert.ok(plan.illustrativeBandwidthBytes<2_000_000_000);assert.ok(plan.peakDayCommands<5000);assert.equal(plan.productionActivationPermitted,false);
 assert.ok(resumeOperatingPlan({...o,cacheMissesPerDay:100}).illustrativeCommandsPer30Days>100000);
});

test('a delayed transport receipt cannot reset the age of older source observations',async()=>{
 const x=setup();try{const c=capture(seed());c.receivedAt=iso(epoch+300000);const p=new ResumePipeline(x.store,{read:async()=>c},()=>0);assert.equal((await p.ingest(c,epoch+300000)).status,'updated');const d:any=await p.display(epoch+300000);assert.equal(d.checkedAt,iso(epoch));assert.equal((await p.display(epoch+360001) as any).status,'withheld');}finally{fs.rmSync(x.dir,{recursive:true,force:true});}
});
