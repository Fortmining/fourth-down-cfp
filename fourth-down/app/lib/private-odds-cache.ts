import {therundownProvider,inspectRundown} from './therundown-odds.ts';
import {easternOffset} from './odds-matching.ts';
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
export const oddsVerificationDates=['2026-11-26','2026-11-27','2026-11-28'] as const;
const budgetScope=scope+':three-day-et-v2';
/** User-authorized three-date verification. Distinct Eastern dates, one attempt/date/UTC day,
 * at most three attempts/day and ten/month. Reserve 5,000 points per attempt, record actual
 * X-Datapoints and stop if provider remaining is below that reserve. Legacy counters stay intact.
 * Captured snapshots expire in six hours (below Free's 24-hour retention), never auto-refresh.
 */
export async function privateOddsSnapshot(date:string,provider:OddsProvider=therundownProvider,cachedOnly=false,retryTransport=false){
 if(!oddsVerificationDates.some(d=>d===date))throw Error('Date is outside the authorized November 26–28 Eastern verification window');
 if(Date.parse(date+'T00:00:00Z')+(easternOffset(date)+1440)*60000<=Date.now())throw Error('This Eastern game date has ended; no historical odds request was made');
 if(provider.id==='therundown'&&!(process.env.THERUNDOWN_API_KEY||process.env.rundown))throw Error('Configure the server-side TheRundown key before fetching odds');
 const key=budgetScope+':'+provider.id+':'+date,cached=await redis('GET',key);
 if(cached){const stored=JSON.parse(cached) as OddsSnapshot;if(stored.source){const parsed=inspectRundown(stored.source,Date.parse(stored.observedAt),{scheduledOnly:true,mainOnly:true});stored.quotes=parsed.quotes;stored.events=parsed.events;if(stored.diagnostics)stored.diagnostics={...stored.diagnostics,rawPriceRows:parsed.rawPriceRows,acceptedPriceRows:parsed.quotes.length,rejected:parsed.rejected,marketIds:parsed.marketIds,bookIds:parsed.bookIds};}return {...stored,cached:true};}
 if(cachedOnly)throw Error('No captured private snapshot for this Eastern date. Fetch it once in the private lab.');
 const now=new Date().toISOString(),day=budgetScope+':day:'+now.slice(0,10),month=budgetScope+':month:'+now.slice(0,7),attempt=day+':date:'+date,remainingKey=budgetScope+':provider-remaining';
 const granted=await redis('EVAL',`local available=redis.call('GET',KEYS[4]);if available and tonumber(available)<5000 then return 0 end
 if redis.call('EXISTS',KEYS[1])==1 then
 -- One explicit transport retry for the observed Nov 27 HTTP 429. Original reservation stays charged.
 if ARGV[1]=='1' and redis.call('SET',KEYS[6],'1','NX','EX',172800) then return 2 end
 return 0 end
 if tonumber(redis.call('GET',KEYS[2]) or '0')>=3 or tonumber(redis.call('GET',KEYS[3]) or '0')>=10 then return 0 end
 local remaining=redis.call('GET',KEYS[4]);if remaining and tonumber(remaining)<5000 then return 0 end
 redis.call('SET',KEYS[1],'1','EX',172800)
 redis.call('INCR',KEYS[2]);redis.call('EXPIRE',KEYS[2],172800)
 redis.call('INCR',KEYS[3]);redis.call('EXPIRE',KEYS[3],2764800)
 redis.call('INCRBY',KEYS[5],5000);redis.call('EXPIRE',KEYS[5],172800)
 return 1`,6,attempt,day,month,remainingKey,day+':reserved',attempt+':transport-retry',(retryTransport&&date==='2026-11-27')?'1':'0');
 if(granted!==1&&granted!==2)throw Error('Bounded verification limit reached or provider reserve too low. No repeated upstream request was made.');
 const snapshot=await provider.fetchPregame(date);
 if(snapshot.datapoints===null)throw Error('Provider omitted X-Datapoints; refresh halted');
 const stored={...snapshot,expiresAt:new Date(Date.parse(snapshot.observedAt)+6*3600000).toISOString()};
 await redis('EVAL',`redis.call('INCRBY',KEYS[1],ARGV[1]);redis.call('EXPIRE',KEYS[1],2764800);redis.call('SET',KEYS[2],ARGV[2],'EX',21600);if ARGV[3]~='' then redis.call('SET',KEYS[3],ARGV[3],'EX',86400) end;return 1`,3,month+':actual',key,remainingKey,snapshot.datapoints,JSON.stringify(stored),snapshot.remaining??'');
 return {...stored,cached:false};
}
