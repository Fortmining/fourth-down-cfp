import {hash} from './engine.ts';import {editionsFromEspn} from './espn.ts';import {publishedEditionIdentity} from './edition-identity.ts';import type {CapturedResumeBatch} from './current-resume-producer';
export const resumeReleaseValue='confirmed-2026-v1';
export type ResumeSyncReceipt={signature:string|null;status:'accepted'|'failed'|'deferred'|'source-withheld';at:number;lastAcceptedAt?:number;failures:number;nextAttemptAt:number};
export function releasedResumesEnabled(env:Record<string,string|undefined>=process.env){return env.FOURTH_DOWN_RESUME_RELEASE===resumeReleaseValue;}
/** Only confirmed results and schedule/publication facts trigger the confirmed
 * release. Live scores/clocks do not manufacture a confirmed model change. */
export function incomingConfirmedSignature(batch:CapturedResumeBatch,now:number){
 const b=batch.scoreboard as any,at=Date.parse(batch.observedAt),received=Date.parse(batch.trace.receivedAt);
 if(b?.season?.year!==2026||!Array.isArray(b.events)||!batch.trace.ok||batch.trace.policy!=='no-store'||!Number.isFinite(at)||!Number.isFinite(received)||at<received||at>now||now-received>360000||(batch.trace.ageSeconds??0)>30)throw Error('Fresh 2026 capture required');
 const games=b.events.map((e:any)=>{const c=e.competitions?.[0],state=e.status?.type??c?.status?.type,teams=c?.competitors;if(!/^\d+$/.test(String(e.id))||teams?.length!==2)throw Error('Source participant identity missing');return {id:String(e.id),date:e.date,timeValid:e.timeValid??c.timeValid??null,teams:teams.map((t:any)=>({id:String(t.team.id),...(state?.state==='post'&&state.completed?{score:t.score,winner:t.winner===true}:{})})).sort((a:any,z:any)=>a.id.localeCompare(z.id)),final:state?.state==='post'&&state.completed===true};}).sort((a:any,z:any)=>a.id.localeCompare(z.id));
 const editions=batch.rankings?editionsFromEspn(batch.rankings,2026,batch.observedAt).map(publishedEditionIdentity):[];
 return hash({season:2026,games,editions});
}
export async function synchronizeConfirmedRelease(batch:CapturedResumeBatch|undefined,previous:unknown,now:number,allowed:boolean,execute:(signal:AbortSignal)=>Promise<{status:string;updated:boolean}>):Promise<ResumeSyncReceipt>{
 const p=previous&&typeof previous==='object'?previous as Partial<ResumeSyncReceipt>:{};let signature:string|null=null;
 const receipt=(status:ResumeSyncReceipt['status'],failures=0,nextAttemptAt=0):ResumeSyncReceipt=>({signature,status,at:now,...(Number.isFinite(p.lastAcceptedAt)?{lastAcceptedAt:p.lastAcceptedAt}:{}),failures,nextAttemptAt});
 try{if(!batch)throw Error('Source capture missing');signature=incomingConfirmedSignature(batch,now);}catch{return receipt('source-withheld');}
 if(p.signature===signature&&p.status==='accepted'&&Number.isFinite(p.lastAcceptedAt)&&Number(p.lastAcceptedAt)<=now)return {...receipt('accepted'),lastAcceptedAt:p.lastAcceptedAt};
 if(p.signature===signature&&Number(p.nextAttemptAt)>now)return {...receipt(p.status==='failed'?'failed':'deferred',p.failures??0,p.nextAttemptAt),lastAcceptedAt:p.lastAcceptedAt};
 if(!allowed)return receipt('deferred',0,now+180000);
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
 try{const result=await execute(abort.signal);if(result.updated||result.status==='unchanged')return {...receipt('accepted'),lastAcceptedAt:now};throw Error('Independent update withheld');}
 catch{const failures=(p.signature===signature?p.failures??0:0)+1;return receipt('failed',failures,now+(failures>=3?1800000:180000));}
 finally{clearTimeout(timer);}
}
