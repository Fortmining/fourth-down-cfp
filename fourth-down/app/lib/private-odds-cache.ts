import {therundownProvider,inspectRundown} from './therundown-odds.ts';
import {easternOffset} from './odds-matching.ts';
import type {OddsProvider,OddsSnapshot} from './odds-provider';
const scope='fd:{private-odds-v1}';
export function cacheFailure(status:number,error:unknown){
 const message=typeof error==='string'?error:'';
 const reason=status===401||/wrongpass|unauthorized|unauthenticated|invalid (password|token)/i.test(message)?'authentication rejected':/noperm|readonly|read.only|permission|not allowed/i.test(message)?'command permission denied':status===429||/quota|limit exceeded|too many/i.test(message)?'service quota reached':status===404?'service endpoint not found':'command rejected';
 return `Private odds cache unavailable (HTTP ${status}: ${reason})`;
}
export async function oddsRedis(...command:(string|number)[]){const url=process.env.ODDS_PILOT_REDIS_URL,token=process.env.ODDS_PILOT_REDIS_TOKEN;
 if(!url||!token)throw Error('Private odds requires the existing Redis cache');
 try{if(new URL(url).protocol!=='https:')throw Error();}catch{throw Error('Private odds cache requires an HTTPS REST URL');}
 if(/[\r\n]/.test(token))throw Error('Private odds cache token contains a line break');
 let r:Response;
 try{r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(4000)});}catch(error){throw Error(error instanceof Error&&error.name==='TimeoutError'?'Private odds cache connection timed out':'Private odds cache connection failed');}
 const body=await r.json().catch(()=>null);if(!r.ok||!body||body.error)throw Error(cacheFailure(r.status,body?.error));return body.result;
}
/** Authenticated cache-only write/read/delete proof. No provider call or quota reset. */
export async function probePrivateOddsCache(){
 const nonce=crypto.randomUUID(),key=scope+':probe:'+nonce;
 const result=await oddsRedis('EVAL',"redis.call('SET',KEYS[1],ARGV[1],'EX',30);local value=redis.call('GET',KEYS[1]);redis.call('DEL',KEYS[1]);return value",1,key,nonce);
 if(result!==nonce)throw Error('Private cache probe did not round-trip');
 return {cacheProbe:'passed',operations:['write','read','delete'],providerCalled:false};
}
export const oddsVerificationDates=['2026-11-26','2026-11-27','2026-11-28'] as const;
const budgetScope=scope+':three-day-et-v2';
/** Preserve the existing three-date quota namespace and counters. One date attempt per UTC
 * day, at most three/day and ten/month; 5,000-point reservation per attempt. No resets.
 * Auto-capture only on an authenticated pregame cache miss/stale read or daily cron.
 * Each price retains its own capture time: refresh never extends older prices past 24h.
 */
export function retainedSnapshot(stored:OddsSnapshot,now=Date.now()):OddsSnapshot{
 if(stored.source){const parsed=inspectRundown(stored.source,Date.parse(stored.observedAt),{scheduledOnly:true,mainOnly:true});stored={...stored,quotes:parsed.quotes,events:parsed.events};}
 const quotes=stored.quotes.map(q=>({...q,capturedAt:q.capturedAt||stored.observedAt})).filter(q=>{
  const at=Date.parse(q.capturedAt);return Number.isFinite(at)&&at<=now&&now-at<86400000&&at<Date.parse(q.startsAt);
 });
 const {source:unused,...safe}=stored;void unused;
 return {...safe,quotes};
}
export function mergeOddsSnapshots(previous:OddsSnapshot|null,next:OddsSnapshot):OddsSnapshot{
 const current=retainedSnapshot(next),old=previous?retainedSnapshot(previous):null;
 const replaced=new Set(current.quotes.map(q=>q.eventId));
 const events=new Map((old?.events||[]).map(e=>[e.id,e]));
 for(const event of current.events||[])if(!events.has(event.id)||replaced.has(event.id))events.set(event.id,event);
 return {...current,quotes:[...(old?.quotes||[]).filter(q=>!replaced.has(q.eventId)),...current.quotes],events:[...events.values()],expiresAt:new Date(Date.parse(next.observedAt)+86400000).toISOString()};
}
export async function privateOddsSnapshot(date:string,provider:OddsProvider=therundownProvider,cachedOnly=false){
 if(!oddsVerificationDates.some(d=>d===date))throw Error('Date is outside the authorized November 26–28 Eastern verification window');
 const key=budgetScope+':'+provider.id+':'+date,cached=await oddsRedis('GET',key);
 const priorStored=cached?retainedSnapshot(JSON.parse(cached) as OddsSnapshot):null;
 let previous=priorStored;
 // Old captures live in separate expiring keys. A new capture cannot prolong their storage.
 if(previous?.previousSnapshotKey){const older=await oddsRedis('GET',previous.previousSnapshotKey);if(older)previous=mergeOddsSnapshots(retainedSnapshot(JSON.parse(older)),previous);}
 if(previous&&(cachedOnly||Date.now()-Date.parse(previous.observedAt)<6*3600000))return {...previous,cached:true};
 if(cachedOnly)throw Error('Pregame odds were not captured for this game.');
 if(Date.parse(date+'T00:00:00Z')+(easternOffset(date)+1440)*60000<=Date.now()){
  if(previous)return {...previous,cached:true};throw Error('Pregame odds were not captured for this game.');
 }
 if(provider.id==='therundown'&&!(process.env.THERUNDOWN_API_KEY||process.env.rundown))throw Error('Odds capture is temporarily unavailable');
 const now=new Date().toISOString(),day=budgetScope+':day:'+now.slice(0,10),month=budgetScope+':month:'+now.slice(0,7),attempt=day+':date:'+date,remainingKey=budgetScope+':provider-remaining';
 const granted=await oddsRedis('EVAL',`local available=redis.call('GET',KEYS[4]);if available and tonumber(available)<5000 then return 0 end
 if redis.call('EXISTS',KEYS[1])==1 then return 0 end
 if tonumber(redis.call('GET',KEYS[2]) or '0')>=3 or tonumber(redis.call('GET',KEYS[3]) or '0')>=10 then return 0 end
 redis.call('SET',KEYS[1],'1','EX',172800)
 redis.call('INCR',KEYS[2]);redis.call('EXPIRE',KEYS[2],172800)
 redis.call('INCR',KEYS[3]);redis.call('EXPIRE',KEYS[3],2764800)
 redis.call('INCRBY',KEYS[5],5000);redis.call('EXPIRE',KEYS[5],172800)
 return 1`,5,attempt,day,month,remainingKey,day+':reserved');
 if(granted!==1){if(previous)return {...previous,cached:true};throw Error('Odds are temporarily unavailable. The daily capture allowance is protected.');}
 try{
 const snapshot=await provider.fetchPregame(date);
 if(snapshot.datapoints===null)throw Error('Provider omitted usage accounting; capture stopped');
 const archiveKey=priorStored?key+':capture:'+Date.parse(priorStored.observedAt):key+':unused';
 const archiveTtl=priorStored?Math.max(0,Math.floor((Date.parse(priorStored.observedAt)+86400000-Date.now())/1000)):0;
 const stored={...retainedSnapshot(snapshot),expiresAt:new Date(Date.parse(snapshot.observedAt)+86400000).toISOString(),...(archiveTtl>0?{previousSnapshotKey:archiveKey}:{})};
 // Raw provider payload is discarded. Price-level retention is also checked on every read.
 await oddsRedis('EVAL',`redis.call('INCRBY',KEYS[1],ARGV[1]);redis.call('EXPIRE',KEYS[1],2764800);if tonumber(ARGV[4])>0 then redis.call('SET',KEYS[4],ARGV[5],'EX',ARGV[4]) end;redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[6]);if ARGV[3]~='' then redis.call('SET',KEYS[3],ARGV[3],'EX',86400) end;return 1`,4,month+':actual',key,remainingKey,archiveKey,snapshot.datapoints,JSON.stringify(stored),snapshot.remaining??'',archiveTtl,JSON.stringify(priorStored),Math.max(1,Math.floor((Date.parse(snapshot.observedAt)+86400000-Date.now())/1000)));
 return {...mergeOddsSnapshots(previous,stored),cached:false};
 }catch(error){if(previous)return {...previous,cached:true};throw error;}
}
