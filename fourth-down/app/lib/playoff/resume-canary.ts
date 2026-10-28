import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {gunzipSync} from 'node:zlib';
import {benchmarkFixtureBase64} from './benchmark-fixture.ts';import {FileResumeStore} from './file-resume-store.ts';import {ResumeCenterService} from './resume-center-service.ts';import type {Inputs} from './types';
export const canaryLimits=Object.freeze({api:20,pages:8,assets:32,cleanup:4,total:64,bodyBytes:32*1024*1024,concurrency:4,retries:0,workMs:600000,cacheSeconds:60,cachePacketBytes:768*1024});
export function canaryEnabled(env:Record<string,string|undefined>=process.env,now=Date.now()){
 const start=Date.parse(env.FOURTH_DOWN_CANARY_START??''),end=Date.parse(env.FOURTH_DOWN_CANARY_END??'');
 return /^[a-f0-9]{24}$/.test(env.FOURTH_DOWN_CANARY_RUN??'')&&(env.NODE_ENV==='development'||env.VERCEL_ENV==='preview')&&Number.isFinite(start)&&Number.isFinite(end)&&end-start>0&&end-start<=30*60000&&now>=start&&now<end;
}
/** Controlled 2026 replay, no network, Redis, push, account data or scheduler.
 * The temporary file store is per cache fill, not claimed distributed persistence. */
export async function buildCanaryResume(stage:'before'|'after'){
 const started=performance.now(),cpu=process.cpuUsage(),seed:Inputs=JSON.parse(gunzipSync(Buffer.from(benchmarkFixtureBase64,'base64')).toString()),at=Date.parse(seed.observedAt);
 const latestPollDate=seed.editions.map(e=>e.date).sort().at(-1),ranked=new Set(seed.editions.filter(e=>e.date===latestPollDate).flatMap(e=>e.ranks.map(r=>r.id)));
 const game=seed.games.find(g=>g.state==='pre'&&g.teams.some(id=>ranked.has(id))&&g.teams.every(id=>seed.teams.some(t=>t.id===id)));if(!game)throw Error('Controlled replay fixture unavailable');
 game.date=new Date(at-3600000).toISOString();
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fd-canary-'));
 try{
 const service=new ResumeCenterService(new FileResumeStore(root),seed),batch=(now:number,events:unknown[]=[])=>({scoreboard:{season:{year:2026},events},observedAt:new Date(now).toISOString(),trace:{ok:true,policy:'no-store',receivedAt:new Date(now).toISOString(),ageSeconds:0}});
 const initial=await service.acceptConfirmedSource(batch(at),at);if(!initial.updated)throw Error('Canary baseline withheld');
 if(stage==='after'){
 const event={id:game.id,date:game.date,status:{type:{state:'post',completed:true},period:4,clock:0},competitions:[{competitors:game.teams.map((id,k)=>({team:{id},score:k?'14':'28',winner:k===0}))}]};
 if(!(await service.acceptConfirmedSource(batch(at+1000,[event]),at+1000)).updated)throw Error('Canary final withheld');
 const duplicate=await service.acceptConfirmedSource(batch(at+2000,[event]),at+2000);if(duplicate.updated)throw Error('Duplicate canary checkpoint');
 }
 const now=at+(stage==='after'?2000:0),packet:any=await service.display(null,now);if(packet.status!=='ready'||packet.history.length!==(stage==='after'?2:1))throw Error('Canary history mismatch');
 const stale:any=await service.display(null,now+360001);if(stale.status!=='withheld'||stale.view.rows.some((r:any)=>r.movement!==null))throw Error('Stale canary display unsafe');
 const used=process.cpuUsage(cpu),result={...packet,canary:{stage,controlled:true,label:'Controlled 2026 replay — synthetic final, not a real game update or live outlook',gameId:game.id,teams:game.teams,duplicatePrevented:stage==='after',staleWithheld:true,redisCommands:0,sourceRequests:0,cacheFillId:crypto.randomUUID(),cpuMs:(used.user+used.system)/1000,elapsedMs:performance.now()-started}};
 if(Buffer.byteLength(JSON.stringify(result))>canaryLimits.cachePacketBytes)throw Error('Canary packet byte cap: '+Buffer.byteLength(JSON.stringify(result)));return result;
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
/** Cache fill IDs are diagnostics, not model identity. Different workers may fill
 * the same deterministic packet. Measure that amplification; never accept
 * differing records/rankings/movement just because each request returned 200. */
export function assessCanaryWarmReads(packets:any[]){
 if(packets.length<2)throw Error('At least two observed cache reads required');
 const semantic=(p:any)=>{const v=p?.view;if(!v||!Array.isArray(v.rows)||typeof v.modelVersion!=='string'||!/^[a-f0-9]{64}$/.test(v.snapshotId??'')||!/^[a-f0-9]{64}$/.test(v.sourceInputHash??'')||typeof p.canary?.cacheFillId!=='string')throw Error('Canary identity evidence missing');return JSON.stringify({at:v.at,modelVersion:v.modelVersion,snapshotId:v.snapshotId,sourceInputHash:v.sourceInputHash,officialEditions:v.officialEditions,rows:v.rows});};
 const identity=semantic(packets[0]);if(packets.some(p=>semantic(p)!==identity))throw Error('Cached resume data diverged across workers');
 const distinctFills=new Set(packets.map(p=>p.canary.cacheFillId)).size;
 return {requests:packets.length,distinctFills,observedReuse:distinctFills<packets.length,globalSingleFill:distinctFills===1};
}
