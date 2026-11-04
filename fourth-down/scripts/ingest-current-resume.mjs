// Reuse captured inputs: zero network requests, zero Redis calls, no scheduler.
import fs from 'node:fs';import path from 'node:path';
import {ResumeCenterService} from '../app/lib/playoff/resume-center-service.ts';
import {FileResumeStore} from '../app/lib/playoff/file-resume-store.ts';
import {hash} from '../app/lib/playoff/engine.ts';
const seedFile=process.env.RESUME_CURRENT_SEED,sourceFile=process.env.RESUME_CURRENT_CAPTURE,root=process.env.RESUME_CURRENT_STORE;
if(!seedFile||!sourceFile||!root)throw Error('Explicit verified 2026 seed, capture file and private store required');
const read=file=>{if(fs.statSync(file).size>2*1024*1024)throw Error('Captured source exceeds byte bound');return JSON.parse(fs.readFileSync(file,'utf8'));};
const seed=read(seedFile),service=new ResumeCenterService(new FileResumeStore(root),seed),pipeline=service.pipeline;
if(!await pipeline.confirmedInputs())await pipeline.ingest({inputs:seed,receivedAt:seed.observedAt,sourceHashes:{seed:hash(seed)},notes:['Saved verified 2026 baseline; not a new source observation']},Date.parse(seed.observedAt));
let loading=false,dirty=false;
async function ingest(){dirty=true;if(loading)return;loading=true;try{while(dirty){dirty=false;const batch=read(sourceFile);console.log(JSON.stringify(await service.acceptConfirmedSource(batch)));}}finally{loading=false;}}
await ingest();
if(process.env.RESUME_CURRENT_WATCH==='true'){
 const watcher=fs.watch(path.dirname(sourceFile),(_,file)=>{if(String(file)===path.basename(sourceFile))void ingest().catch(()=>console.log(JSON.stringify({status:'source-withheld',updated:false})));});
 process.on('SIGTERM',()=>watcher.close());
}
