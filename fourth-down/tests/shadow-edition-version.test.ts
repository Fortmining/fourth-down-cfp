import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validPublishedEdition} from '../app/lib/playoff/published-edition.ts';
import {runShadow,compareSnapshots} from '../app/lib/playoff/engine.ts';
import {ShadowArchive} from '../app/lib/playoff/archive.ts';
import {packSnapshotPair,replaySnapshotPair} from '../app/lib/playoff/storage-plan.ts';
import type {Edition,Inputs} from '../app/lib/playoff/types.ts';
const edition:Edition={id:'ap',date:'2024-10-13T07:00Z',season:2024,ranks:Array.from({length:26},(_,i)=>({id:String(i+1),rank:Math.min(25,i+1),record:'0-0',previous:null}))};
const input:Inputs={season:2024,observedAt:'2024-10-16T20:00Z',teams:Array.from({length:30},(_,i)=>({id:String(i+1),name:'Synthetic '+i,conference:'8',eligible:null})),games:[],editions:[edition],coverage:{complete:true,issues:[]},rulesVersion:'historical-resume-no-qualification-v1'};
test('private published-edition validator preserves all tied teams and enforces competition ranks',()=>{
 assert.equal(validPublishedEdition(edition),true);assert.equal(validPublishedEdition({...edition,ranks:edition.ranks.slice(0,24)}),false);
 assert.equal(validPublishedEdition({...edition,ranks:edition.ranks.map((r,i)=>i===25?{...r,id:'25'}:r)}),false);
 const wrong=structuredClone(edition);wrong.ranks[1].rank=1;wrong.ranks[2].rank=2;assert.equal(validPublishedEdition(wrong),false);
 const valid=structuredClone(edition);valid.ranks[1].rank=1;valid.ranks[2].rank=3;assert.equal(validPublishedEdition(valid),true);
 const dense=structuredClone(edition);dense.ranks[24].rank=24;assert.equal(validPublishedEdition(dense),false);
});
test('v1.1 stays frozen while opt-in v1.2 accepts genuine tied publication without altering it',()=>{
 const before=JSON.stringify(input),old=runShadow(input),next=runShadow(input,undefined,false,null,'resume-shadow-v1.2.0');
 assert.ok(old.issues.includes('Invalid ap edition'));assert.equal(next.issues.includes('Invalid ap edition'),false);
 assert.equal(old.modelVersion,'resume-shadow-v1.1.0');assert.equal(next.modelVersion,'resume-shadow-v1.2.0');
 assert.notEqual(old.id,next.id);assert.equal(JSON.stringify(input),before);assert.equal(next.inputs.editions[0].ranks.length,26);
 assert.throws(()=>compareSnapshots(old,next));assert.equal(runShadow(input).id,old.id);
});
test('versioned snapshot archives and compressed pairs replay both model versions exactly',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'fourth-shadow-versions-'));
 try{const archive=new ShadowArchive(dir);
  for(const version of ['resume-shadow-v1.1.0','resume-shadow-v1.2.0'] as const){
   const c=runShadow(input,undefined,false,null,version),p=runShadow(input,undefined,true,c.id,version);
   archive.save(c);archive.save(p);assert.deepEqual(archive.restore(c.id),c);assert.deepEqual(archive.restore(p.id),p);
   const packed=packSnapshotPair(c,p),replayed=replaySnapshotPair(packed.encoded);assert.deepEqual(replayed.confirmed,c);assert.deepEqual(replayed.provisional,p);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
