import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {RedisResumeStore,resumeTransactionScript,type PrivateRedisPort} from '../app/lib/playoff/redis-resume-store.ts';
const namespace='fd:{resume-private-0123456789abcdef}:';
// Deliberate protocol simulator. It does not execute Lua or establish hosted support.
function transport(limit=4){
 let raw='',display='',head='',used=0,lost=false,omitDisplay=false,omitHead=false;const calls:(string|number)[][]=[];
 const digest=(s:string)=>createHash('sha1').update(s).digest('hex');
 const redis:PrivateRedisPort=async(...c)=>{
  calls.push(c);assert.equal(c[0],'EVAL');assert.equal(c[1],resumeTransactionScript);assert.deepEqual(c.slice(3,7),[namespace+'state',namespace+'meter',namespace+'display',namespace+'head']);
  if(used>=limit)return ['limited'];used++;
  if(c[7]==='view')return ['read',display,digest(display),digest(raw),head];
  if(c[7]==='read')return ['read',raw,digest(raw)];
  if(c[7]==='fresh'){
   if(!head||!display)return ['refresh-required'];const h=JSON.parse(head),p=JSON.parse(String(c[13]));
   if(h.status!=='ready'||h.signature!==p.signature||h.stateDigest!==digest(raw)||!h.checkedAt||p.checkedAt<h.checkedAt)return ['refresh-required'];
   h.checkedAt=p.checkedAt;head=JSON.stringify(h);if(lost)throw Error('Controlled response loss after freshness');return ['fresh'];
  }
  if(c[8]!==digest(raw))return ['stale'];if(head){const h=JSON.parse(head),n=JSON.parse(String(c[13]));if(h.checkedAt&&(!n.checkedAt||n.checkedAt<h.checkedAt))return ['stale'];}raw=String(c[9]);if(!omitDisplay)display=String(c[12]);if(!omitHead)head=String(c[13]);omitDisplay=false;omitHead=false;
  if(lost)throw Error('Controlled response loss after commit');return ['committed'];
 };
 return {redis,calls,lose:()=>{lost=true;},omitNextDisplay:()=>{omitDisplay=true;},omitNextHead:()=>{omitHead=true;}};
}
test('private shared store persists checksum-protected state through declared keys only',async()=>{const t=transport(),s=new RedisResumeStore(t.redis,namespace);await s.transaction(v=>{v.revision=1;});assert.equal(await s.transaction(v=>v.revision),1);assert.equal(t.calls.length,3);assert.throws(()=>new RedisResumeStore(t.redis,'fd:v05:'));});
test('shared quota rejects before callback work and cannot become an unbounded retry loop',async()=>{const t=transport(),s=new RedisResumeStore(t.redis,namespace);await s.transaction(v=>{v.revision=1;});await s.transaction(v=>{v.revision=2;});let called=false;await assert.rejects(s.transaction(()=>{called=true;}));assert.equal(called,false);assert.equal(t.calls.length,5);});
test('an ambiguous commit is not transparently repeated',async()=>{const t=transport(),s=new RedisResumeStore(t.redis,namespace);t.lose();await assert.rejects(s.transaction(v=>{v.revision=1;}));assert.equal(t.calls.length,2);assert.equal(await s.transaction(v=>v.revision),1);});
test('Lua candidate meters read/commit and rejects foreign keys; no credential transport is installed',()=>{assert.match(resumeTransactionScript,/commandCost=mode=='commit' and 9/);assert.match(resumeTransactionScript,/mutationCost=mode=='commit' and 4/);assert.match(resumeTransactionScript,/return \{'limited'\}/);assert.match(resumeTransactionScript,/redis\.sha1hex\(current\)~=expected/);assert.match(resumeTransactionScript,/EX',3024000/);});

test('coordinator → injected Redis CAS protocol → retained replay → display works without live Redis',async()=>{
 const fs=await import('node:fs');const {gunzipSync}=await import('node:zlib');const {ResumePipeline}=await import('../app/lib/playoff/resume-pipeline.ts');const {hash}=await import('../app/lib/playoff/engine.ts');const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/resume-real-replay.json.gz',import.meta.url))).toString());const t=transport(100),store=new RedisResumeStore(t.redis,namespace);let input=f.before;const pipeline=new ResumePipeline(store,{read:async()=>({inputs:input,receivedAt:input.observedAt,sourceHashes:{fixture:hash(input)}})},()=>0);
 assert.equal((await pipeline.tick(Date.parse(input.observedAt))).status,'updated');input=f.after;assert.equal((await pipeline.tick(Date.parse(input.observedAt))).status,'updated');const display:any=await pipeline.display(Date.parse(input.observedAt));assert.equal(display.history.length,2);assert.equal(display.view.rows.find((r:any)=>r.id==='87').movement,28);assert.equal(display.view.rows.find((r:any)=>r.id==='2633').overall,'5-2');assert.ok(t.calls.length<=10);
});

test('shared display is materialized separately and read without transferring retained snapshot bundles',async()=>{
 const t=transport(20),s=new RedisResumeStore(t.redis,namespace);await s.transaction(v=>{v.revision=2;v.status='ready';});const packet=await s.readDisplay();assert.equal(packet.revision,2);assert.equal(packet.status,'ready');assert.equal(packet.history.length,0);assert.equal(packet.encoded,undefined);assert.equal(t.calls.at(-1)?.[7],'view');assert.equal(t.calls.length,3);
});

test('transfer reservation counts base64 value bodies with bounded script/JSON overhead',()=>{assert.ok(Buffer.byteLength(JSON.stringify(resumeTransactionScript))<8192);assert.match(resumeTransactionScript,/Base64 transport required/);assert.match(resumeTransactionScript,/transferReserve=16384\+/);assert.match(resumeTransactionScript,/meter\.mb\+transferReserve>2000000000/);});

test('partial shared-cache writes cannot serve an older display as the new committed state',async()=>{
 const t=transport(30),s=new RedisResumeStore(t.redis,namespace);await s.transaction(v=>{v.revision=1;});t.omitNextDisplay();await s.transaction(v=>{v.revision=2;});await assert.rejects(s.readDisplay(),/integrity/);await s.transaction(v=>{v.checkedAt='2026-10-27T13:00:00Z';});assert.equal((await s.readDisplay()).revision,2);
});

test('a warm worker never serves its old local view after another shared worker commits',async()=>{
 const fs=await import('node:fs');const {gunzipSync}=await import('node:zlib');const {ResumePipeline}=await import('../app/lib/playoff/resume-pipeline.ts');const {hash}=await import('../app/lib/playoff/engine.ts');const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/resume-real-replay.json.gz',import.meta.url))).toString());const t=transport(100),store=new RedisResumeStore(t.redis,namespace);const c=(i:any)=>({inputs:i,receivedAt:i.observedAt,sourceHashes:{fixture:hash(i)}});const a=new ResumePipeline(store,{read:async()=>c(f.after)},()=>0),now=Date.parse(f.after.observedAt);await a.tick(now);assert.equal((await a.display(now) as any).revision,1);const next=structuredClone(f.after);next.observedAt=new Date(now+1000).toISOString();const game=next.games.find((g:any)=>g.completed&&g.state==='post');game.scores[game.teams.indexOf(game.winner)]++;game.observedAt=next.observedAt;const b=new ResumePipeline(store,{read:async()=>c(next)},()=>0);assert.equal((await b.tick(now+1000)).status,'updated');assert.equal((await a.display(now+1000) as any).revision,2);
});

test('compact verified freshness renews display without transferring or rewriting the archive',async()=>{
 const fs=await import('node:fs');const {gunzipSync}=await import('node:zlib');const {ResumePipeline}=await import('../app/lib/playoff/resume-pipeline.ts');const {hash}=await import('../app/lib/playoff/engine.ts');
 const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/resume-real-replay.json.gz',import.meta.url))).toString());let now=Date.parse(f.after.observedAt);const t=transport(100),store=new RedisResumeStore(t.redis,namespace,()=>now),pipeline=new ResumePipeline(store,{read:async()=>{throw Error('Must not fetch another source');}},()=>0);
 const capture=(i:any)=>({inputs:i,receivedAt:i.observedAt,sourceHashes:{fixture:hash(i)}});
 assert.equal((await pipeline.ingest(capture(f.after),now)).status,'updated');
 const before=t.calls.length;
 for(let n=1;n<=4;n++){now+=240000;const i=structuredClone(f.after);i.observedAt=new Date(now).toISOString();const result=await pipeline.ingest(capture(i),now);assert.equal(result.status,'unchanged');assert.equal('compactFreshness' in result&&result.compactFreshness,true);const view:any=await pipeline.display(now);assert.equal(view.status,'ready');assert.equal(view.history.length,1);assert.equal(view.checkedAt,i.observedAt);}
 assert.equal(t.calls.length-before,8);assert.ok(t.calls.slice(before).every(c=>c[7]==='fresh'||c[7]==='view'));assert.ok(t.calls.slice(before).filter(c=>c[7]==='fresh').every(c=>JSON.stringify(c.slice(8)).length<1024));
});
test('missing or partially written freshness heads fail closed and are repaired by a new verified commit',async()=>{
 const t=transport(30),s=new RedisResumeStore(t.redis,namespace);await s.transaction(v=>{v.revision=1;v.status='ready';v.checkedAt='2026-10-27T13:00:00.000Z';v.sourceSignature='a'.repeat(64);});t.omitNextHead();await s.transaction(v=>{v.revision=2;});await assert.rejects(s.readDisplay(),/freshness/);assert.equal(await s.renewVerifiedFreshness('a'.repeat(64),new Date().toISOString()),false);await s.transaction(v=>{v.revision=3;});assert.equal((await s.readDisplay()).revision,3);
});
test('compact freshness cannot accept a changed signature, future timestamp or missing materialization',async()=>{
 const now=Date.parse('2026-10-27T13:00:00Z'),t=transport(30),s=new RedisResumeStore(t.redis,namespace,()=>now);assert.equal(await s.renewVerifiedFreshness('a'.repeat(64),new Date(now).toISOString()),false);
 await assert.rejects(s.renewVerifiedFreshness('a'.repeat(64),new Date(now+1).toISOString()));await s.transaction(v=>{v.status='ready';v.checkedAt=new Date(now).toISOString();v.sourceSignature='a'.repeat(64);});assert.equal(await s.renewVerifiedFreshness('b'.repeat(64),new Date(now).toISOString()),false);
});

test('a full-state writer cannot regress a newer compact freshness checkpoint',async()=>{
 const at=Date.parse('2026-10-27T13:00:00Z'),t=transport(30),s=new RedisResumeStore(t.redis,namespace,()=>at+240000);await s.transaction(v=>{v.revision=1;v.checkedAt=new Date(at).toISOString();v.status='ready';v.sourceSignature='a'.repeat(64);});assert.equal(await s.renewVerifiedFreshness('a'.repeat(64),new Date(at+240000).toISOString()),true);await assert.rejects(s.transaction(v=>{v.revision=2;}));assert.equal((await s.readDisplay()).checkedAt,new Date(at+240000).toISOString());
});
test('an ambiguous compact renewal is not followed by hidden full-state retries',async()=>{
 const {ResumePipeline}=await import('../app/lib/playoff/resume-pipeline.ts');const fs=await import('node:fs');const {gunzipSync}=await import('node:zlib');const {hash}=await import('../app/lib/playoff/engine.ts');const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/resume-real-replay.json.gz',import.meta.url))).toString());let now=Date.parse(f.after.observedAt);const t=transport(100),s=new RedisResumeStore(t.redis,namespace,()=>now),p=new ResumePipeline(s,{read:async()=>{throw Error('No fetch');}},()=>0);const capture=(i:any)=>({inputs:i,receivedAt:i.observedAt,sourceHashes:{fixture:hash(i)}});await p.ingest(capture(f.after),now);t.lose();now+=240000;const i={...structuredClone(f.after),observedAt:new Date(now).toISOString()},before=t.calls.length;assert.equal((await p.ingest(capture(i),now)).status,'freshness-unavailable');assert.equal(t.calls.length-before,1);assert.equal((await s.readDisplay()).checkedAt,i.observedAt);
});
