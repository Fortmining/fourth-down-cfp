import {therundownProvider} from './therundown-odds.ts';
import type {OddsProvider,OddsSnapshot} from './odds-provider';
const scope='fd:{private-odds-v1}';
async function redis(...command:(string|number)[]){const url=process.env.ODDS_PILOT_REDIS_URL,token=process.env.ODDS_PILOT_REDIS_TOKEN;
 if(!url||!token)throw Error('Private odds requires the existing Redis cache');
 const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(4000)});const body=await r.json();if(!r.ok||body.error)throw Error('Private odds cache unavailable');return body.result;
}
/** Pilot: at most one upstream attempt per UTC day and ten per month, across all dates/instances.
 * Reserve a whole Free daily allowance per attempt. Uncertain/failed attempts stay charged.
 * Actual X-Datapoints are recorded separately. No cron, background polling or new service.
 */
export async function privateOddsSnapshot(date:string,provider:OddsProvider=therundownProvider){
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
