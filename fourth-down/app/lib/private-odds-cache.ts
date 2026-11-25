import {therundownProvider} from './therundown-odds.ts';
import type {OddsProvider,OddsSnapshot} from './odds-provider';
const scope='fd:{private-odds-v1}';
export function cacheFailure(status:number,error:unknown){
 const message=typeof error==='string'?error:'';
 const reason=status===401||/wrongpass|unauthorized|unauthenticated|invalid (password|token)/i.test(message)?'authentication rejected':/noperm|readonly|read.only|permission|not allowed/i.test(message)?'command permission denied':status===429||/quota|limit exceeded|too many/i.test(message)?'service quota reached':status===404?'service endpoint not found':'command rejected';
 return `Private odds cache unavailable (HTTP ${status}: ${reason})`;
}
async function redis(...command:(string|number)[]){const url=process.env.ODDS_PILOT_REDIS_URL,token=process.env.ODDS_PILOT_REDIS_TOKEN;
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
 const result=await redis('EVAL',"redis.call('SET',KEYS[1],ARGV[1],'EX',30);local value=redis.call('GET',KEYS[1]);redis.call('DEL',KEYS[1]);return value",1,key,nonce);
 if(result!==nonce)throw Error('Private cache probe did not round-trip');
 return {cacheProbe:'passed',operations:['write','read','delete'],providerCalled:false};
}
/** Pilot: at most one upstream attempt per UTC day and ten per month, across all dates/instances.
 * Reserve a whole Free daily allowance per attempt. Uncertain/failed attempts stay charged.
 * Actual X-Datapoints are recorded separately. No cron, background polling or new service.
 */
export async function privateOddsSnapshot(date:string,provider:OddsProvider=therundownProvider){
 if(provider.id==='therundown'&&!(process.env.THERUNDOWN_API_KEY||process.env.rundown))throw Error('Configure the server-side TheRundown key before fetching odds');
 const key=scope+':'+provider.id+':'+date,cached=await redis('GET',key);if(cached)return {...JSON.parse(cached) as OddsSnapshot,cached:true};
 const now=new Date().toISOString(),day=scope+':day:'+now.slice(0,10),month=scope+':month:'+now.slice(0,7);
 const granted=await redis('EVAL',`if redis.call('EXISTS',KEYS[1])==1 then return 0 end
 if tonumber(redis.call('GET',KEYS[2]) or '0')>=20000 or tonumber(redis.call('GET',KEYS[3]) or '0')>=200000 then return 0 end
 redis.call('SET',KEYS[1],'1','EX',30)
 redis.call('INCRBY',KEYS[2],20000);redis.call('EXPIRE',KEYS[2],172800)
 redis.call('INCRBY',KEYS[3],20000);redis.call('EXPIRE',KEYS[3],2764800)
 return 1`,3,scope+':lock',day,month);
 if(granted!==1)throw Error('Pilot refresh limit reached; cached data or the next UTC day is required');
 const snapshot=await provider.fetchPregame(date);
 // A missing accounting header fails closed; reservation remains consumed.
 if(snapshot.datapoints===null)throw Error('Provider omitted X-Datapoints; refresh halted');
 await redis('EVAL',`redis.call('INCRBY',KEYS[1],ARGV[1]);redis.call('EXPIRE',KEYS[1],2764800);redis.call('SET',KEYS[2],ARGV[2],'EX',900);return 1`,2,month+':actual',key,snapshot.datapoints,JSON.stringify(snapshot));
 return {...snapshot,cached:false};
}
