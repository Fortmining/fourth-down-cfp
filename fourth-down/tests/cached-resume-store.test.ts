import {test} from 'node:test';import assert from 'node:assert/strict';import {cachedResumeStore} from '../app/lib/playoff/cached-resume-store.ts';import {ResumePipeline,type SharedResumeDisplay} from '../app/lib/playoff/resume-pipeline.ts';
test('cached signed packets reduce consumer reads but never cache a freshness verdict',async()=>{
 let reads=0,invalidations=0,packet:SharedResumeDisplay|null=null;const at=Date.parse('2026-10-27T12:00:00Z');
 const raw:any={schema:1,revision:1,sourceSignature:'a'.repeat(64),checkedAt:new Date(at).toISOString(),status:'ready',issues:[],history:[],view:{at:new Date(at).toISOString(),season:2026,comparison:'confirmed',issues:[],rows:[{movement:1,resumePosition:5,score:1,scoreDelta:1,reasons:[],drivers:[]}]} };
 const store=cachedResumeStore({readDisplay:async()=>{reads++;return structuredClone(raw);},transaction:async op=>op({} as any),renewVerifiedFreshness:async()=>true},{read:async load=>packet??(packet=await load()),invalidate:()=>{invalidations++;packet=null;}});
 const service=new ResumePipeline(store,{read:async()=>{throw Error('No source fetch');}});for(let n=0;n<20;n++)assert.equal((await service.display(at+n*1000) as any).status,'ready');assert.equal(reads,1);
 const stale:any=await service.display(at+360001);assert.equal(stale.status,'withheld');assert.equal(stale.view.rows[0].movement,null);assert.equal(stale.view.rows[0].resumePosition,null);assert.equal(reads,1);
 await store.renewVerifiedFreshness!('a'.repeat(64),new Date(at).toISOString());assert.equal(invalidations,1);await store.readDisplay!();assert.equal(reads,2);
 await store.transaction(()=>null);assert.equal(invalidations,2);
});
