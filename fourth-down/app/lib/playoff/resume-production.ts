import {gunzipSync} from 'node:zlib';import {benchmarkFixtureBase64} from './benchmark-fixture.ts';import {hash} from './engine.ts';import type {Inputs} from './types';
import {redis,redisWithSignal} from '../push-store';import {RedisResumeStore} from './redis-resume-store';import {nextCachedResumeStore} from './next-resume-cache';import {ResumeCenterService} from './resume-center-service';import {releasedResumesEnabled,synchronizeConfirmedRelease} from './confirmed-release';import type {CapturedResumeBatch} from './current-resume-producer';
export const productionResumeNamespace=`fd:{resume-private-${hash('Fourth Down confirmed 2026 v1').slice(0,24)}}:`;
export async function publishReleasedResumes(batch:CapturedResumeBatch|undefined,previous:unknown,startedAt:number){
 if(!releasedResumesEnabled())return undefined;
 return synchronizeConfirmedRelease(batch,previous,Date.now(),Date.now()-startedAt<30000,async signal=>{
  const deadline=Date.now()+12000,port=(...args:(string|number)[])=>{if(Date.now()>=deadline||signal.aborted)throw Error('Resume deadline');return redisWithSignal(AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,deadline-Date.now()))]),...args);};
  const seed:Inputs=JSON.parse(gunzipSync(Buffer.from(benchmarkFixtureBase64,'base64')).toString());
  const store=nextCachedResumeStore(new RedisResumeStore(port,productionResumeNamespace),productionResumeNamespace,300);return new ResumeCenterService(store,seed).acceptConfirmedSource(batch!);
 });
}
export async function latestReleasedResumes(){
 if(!releasedResumesEnabled())return null;
 const store=nextCachedResumeStore(new RedisResumeStore(redis,productionResumeNamespace),productionResumeNamespace,300),packet=await store.readDisplay!();
 if(!packet?.view||packet.view.season!==2026)return null;
 // A saved confirmed evaluation is NOT a live freshness receipt. Preserve its
 // original date; never renew old evidence just because a visitor opened it.
 return {...packet,status:'archived',checkedAt:packet.view.at,private:false,publicActivation:true,view:{...packet.view,privatePreview:false},pendingSourceReconciliation:packet.status!=='ready'};
}
