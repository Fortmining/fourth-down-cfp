// Private file-store replay, not a production transport or a forecast evaluation.
import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {performance} from 'node:perf_hooks';
import {ResumePipeline,pipelineLimits} from '../app/lib/playoff/resume-pipeline.ts';import {FileResumeStore} from '../app/lib/playoff/file-resume-store.ts';import {hash} from '../app/lib/playoff/engine.ts';
const output=process.env.RESUME_INTEGRATION_OUTPUT;if(!output)throw Error('Explicit isolated output required');fs.mkdirSync(output,{recursive:true});
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('../tests/fixtures/resume-real-replay.json.gz',import.meta.url))).toString());
const store=new FileResumeStore(path.join(output,'state'));let current;const pipeline=new ResumePipeline(store,{read:async()=>current});
const cpu=process.cpuUsage(),start=performance.now(),steps=[];
for(const [name,input] of [['before',f.before],['after',f.after],['duplicate',{...f.after,observedAt:new Date(Date.parse(f.after.observedAt)+240000).toISOString()}]]){
 current={inputs:input,receivedAt:input.observedAt,sourceHashes:{archivedInputs:hash(input)},notes:['Archived controlled as-of replay, not a new real event']};
 const t=performance.now(),result=await pipeline.tick(Date.parse(input.observedAt));const display=await pipeline.display(Date.parse(input.observedAt));steps.push({name,...result,ms:performance.now()-t,status:display.status,history:display.history,displayBytes:Buffer.byteLength(JSON.stringify(display)),tennessee:display.view?.rows.find(r=>r.id==='2633')?.overall,notreDameMovement:display.view?.rows.find(r=>r.id==='87')?.movement,explainedRows:display.view?.rows.filter(r=>r.reasons.length).length});
 fs.writeFileSync(path.join(output,name+'-display.json'),JSON.stringify(display));
}
const snapshot=await store.transaction(s=>s),used=process.cpuUsage(cpu);const report={mode:'Offline controlled replay; actual filesystem operations, no hosted cost claim',steps,limits:pipelineLimits,retained:snapshot.history.length,storeBytes:fs.statSync(store.file).size,reservedCandidateCosts:{daily:snapshot.daily,monthly:snapshot.monthly},actualRedisCommands:0,actualQstashDeliveries:0,additionalSourceRequests:0,cpuMs:(used.user+used.system)/1000,wallMs:performance.now()-start,productionActivation:false};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
