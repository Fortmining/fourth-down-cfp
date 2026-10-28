import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {gunzipSync} from 'node:zlib';
import {ResumeCenterService} from '../app/lib/playoff/resume-center-service.ts';import {FileResumeStore} from '../app/lib/playoff/file-resume-store.ts';import {benchmarkFixtureBase64} from '../app/lib/playoff/benchmark-fixture.ts';
test('one service connects captured 2026 results, persisted checkpoints and saved fan display without a source request',async()=>{
 const seed=JSON.parse(gunzipSync(Buffer.from(benchmarkFixtureBase64,'base64')).toString()),now=Date.parse(seed.observedAt),root=fs.mkdtempSync(path.join(os.tmpdir(),'fd-center-'));
 try{
 const writer=new ResumeCenterService(new FileResumeStore(root),seed),batch={scoreboard:{season:{year:2026},events:[]},observedAt:seed.observedAt,trace:{ok:true,policy:'no-store',receivedAt:seed.observedAt,ageSeconds:0}};
 assert.equal((await writer.acceptConfirmedSource(batch,now)).status,'updated');
 const reader=new ResumeCenterService(new FileResumeStore(root)),current:any=await reader.display(null,now);assert.equal(current.status,'ready');assert.equal(current.view.rows.length,138);
 const saved:any=await reader.display(current.history[0].id,now+360001);assert.equal(saved.status,'archived');assert.equal(saved.view.season,2026);assert.equal(saved.checkedAt,seed.observedAt);
 assert.equal((await reader.display(null,now+360001)).status,'withheld');assert.equal((await reader.display('0'.repeat(64),now)).status,'unavailable');assert.throws(()=>reader.acceptConfirmedSource(batch,now),/Display-only/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
