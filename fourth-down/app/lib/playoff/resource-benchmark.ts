import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {gunzipSync,gzipSync} from 'node:zlib';
import {boundedStoreScript} from './bounded-store-script.ts';
import {benchmarkFixtureBase64,benchmarkFixtureSha256} from './benchmark-fixture.ts';
import {runShadow,candidates} from './engine.ts';
import {fanResume} from './fan-resume.ts';
import {retentionEnvelope} from './retention-envelope.ts';
import type {Inputs} from './types';
export type BenchmarkRedis=(...command:(string|number)[])=>Promise<unknown>;
export type BenchmarkBudget={observedAt:string;commandsUsed:number;commandLimit:number;storageUsedBytes:number;storageLimitBytes:number;bandwidthUsedBytes:number;bandwidthLimitBytes:number};
export const resourceLimits=Object.freeze({commandReserve:10000,storageReserveBytes:32_000_000,wireReserveBytes:128_000_000,maxPairs:8,logicalByteLimit:16*1024*1024,mutationLimit:400,snapshotUpdates:12,visitorReads:400,concurrency:5,ttlSeconds:3600,onceTtlSeconds:3024000,maxDurationMs:25000});
export function validateBenchmarkBudget(b:BenchmarkBudget,now=Date.now()){
 if(!b||typeof b.observedAt!=='string'||!Number.isFinite(Date.parse(b.observedAt))||now-Date.parse(b.observedAt)<0||now-Date.parse(b.observedAt)>10*60000||[b.commandsUsed,b.commandLimit,b.storageUsedBytes,b.storageLimitBytes,b.bandwidthUsedBytes,b.bandwidthLimitBytes].some(v=>typeof v!=='number'||!Number.isSafeInteger(v)||v<0))throw Error('Fresh verified budget receipt required');
 if(b.commandLimit!==500000||b.storageLimitBytes!==250_000_000||b.bandwidthLimitBytes!==10_000_000_000)throw Error('Existing free-tier receipt required');
 if(b.commandsUsed+resourceLimits.commandReserve>b.commandLimit*.8||b.storageUsedBytes+resourceLimits.storageReserveBytes>b.storageLimitBytes*.8||b.bandwidthUsedBytes+resourceLimits.wireReserveBytes>b.bandwidthLimitBytes*.8)throw Error('Benchmark would exceed the reserved operating envelope');
}
/** Disabled until an approved protected Preview deployment enables its POST gate.
 * Never reads app keys. No scans, deletes, notification calls or new schedules. */
export async function runResourceBenchmark(redis:BenchmarkRedis,budget:BenchmarkBudget,deployment:string){
 validateBenchmarkBudget(budget);
 if(!deployment||deployment.length>200)throw Error('Deployment identity required');
 const prefix='fd:{resume-benchmark-'+createHash('sha256').update(deployment).digest('hex').slice(0,24)+'}:';
 const names=['head','index','sizes','bytes','payloads'],keys=names.map(n=>prefix+n),allowed=new Set([...keys,prefix+'display',prefix+'once']);
 const source=boundedStoreScript.replace("'fd:{shadow}:'","'"+prefix+"'");
 const lua="local countedReads,countedMutations=0,0; local function countedCall(op,...) if op=='GET' or op=='ZRANGE' or op=='HGETALL' or op=='HGET' then countedReads=countedReads+1 else countedMutations=countedMutations+1 end; return redis.call(op,...) end; local function benchmarkOperation()\n"+source.replaceAll('redis.call(', 'countedCall(')+"\nend; local reply=benchmarkOperation(); return {reply,countedReads,countedMutations}";
 let mutationReserved=6,commandAttempts=0,cachedReadAttempts=0,confirmedScriptReads=0,confirmedScriptMutations=0,ambiguousScriptAttempts=0;
 let reserved=12,transportRetries=0,controlledRetries=0,reads=0,stored=0,head='',recovered=0;
 const started=performance.now(),cpu=process.cpuUsage(),latencies:number[]=[];
 const call=async(...cmd:(string|number)[])=>{
  const op=cmd[0];let usedKeys:string[]=[];
  if(op==='EVAL'){if(cmd[1]!==lua||cmd[2]!==5)throw Error('Invalid benchmark script');usedKeys=cmd.slice(3,8).map(String);if(JSON.stringify(usedKeys)!==JSON.stringify(keys))throw Error('Invalid declared benchmark keys');}
  else if(op==='MEMORY'&&cmd[1]==='USAGE')usedKeys=[String(cmd[2])];
  else if(['GET','SET','HLEN','TTL'].includes(String(op)))usedKeys=[String(cmd[1])];
  else throw Error('Benchmark command rejected');
  if(usedKeys.some(k=>!allowed.has(k)))throw Error('Application key access rejected');
  const mutations=op==='EVAL'?11:op==='SET'?1:0;
  if(mutationReserved+mutations>resourceLimits.mutationLimit)throw Error('Mutation budget exhausted before dispatch');
  if(op==='GET'&&cmd[1]===prefix+'display'&&++cachedReadAttempts>resourceLimits.visitorReads)throw Error('Cached read budget exhausted before dispatch');
  mutationReserved+=mutations;commandAttempts++;
  reserved+=op==='EVAL'?20:1;
  if(reserved>resourceLimits.commandReserve||performance.now()-started>resourceLimits.maxDurationMs)throw Error('Bounded benchmark stopped at its operating limit');
  const t=performance.now();try{const result=await redis(...cmd);if(op==='EVAL'){if(!Array.isArray(result)||result.length!==3||!Number.isSafeInteger(result[1])||!Number.isSafeInteger(result[2])||Number(result[1])<0||Number(result[2])<0||Number(result[1])>4||Number(result[2])>11)throw Error('Invalid script accounting');confirmedScriptReads+=Number(result[1]);confirmedScriptMutations+=Number(result[2]);return result[0];}return result;}catch(error){if(op==='EVAL')ambiguousScriptAttempts++;throw error;}finally{latencies.push(performance.now()-t);}
 };
 if(await call('SET',prefix+'once','one approved run','NX','EX',resourceLimits.onceTtlSeconds)!=='OK')return {status:'already-run',productionActivationPermitted:false,inspectPreviousRunIfIncomplete:true};
 const expiry={attempted:false,verified:false},timing={cpuMs:0,wallMs:0};
 try{
 const fixture=gunzipSync(Buffer.from(benchmarkFixtureBase64,'base64'));
 if(createHash('sha256').update(fixture).digest('hex')!==benchmarkFixtureSha256)throw Error('Fixture identity mismatch');
 const input=JSON.parse(fixture.toString()) as Inputs;
 const confirmed=runShadow(input,candidates[0],false,null,'resume-shadow-v1.2.0'),provisional=runShadow(input,candidates[0],true,confirmed.id,confirmed.modelVersion),pair=retentionEnvelope(confirmed,provisional);
 const packed=JSON.parse(gunzipSync(Buffer.from(pair.encoded,'base64')).toString());let maxPairValueBytes=0;
 const display=gzipSync(JSON.stringify(fanResume(confirmed,confirmed,confirmed.at))).toString('base64');
 if(Buffer.byteLength(display)>128*1024)throw Error('Display cache value exceeds benchmark cap');
 const store=async(command:(string|number)[],receipt:string,simulateLostResponse:boolean)=>{
  let reply:unknown;
  try{reply=await call(...command);}catch{transportRetries++;reply=await call(...command);}
  if(simulateLostResponse){controlledRetries++;reply=await call(...command);}
  if(!Array.isArray(reply))throw Error('Invalid retention reply');
  if(reply[0]==='stored'){head=receipt;stored++;return;}
  // A retry after commit can fail CAS. Verify the exact receipt instead of writing again.
  if(reply[0]==='stale'||reply[0]==='unchanged'){
   const current=JSON.parse(String(await call('GET',keys[0])));
   if(current.id===receipt&&current.semantic===String(command[9])){head=receipt;stored++;recovered++;return;}
  }
  throw Error('Retention outcome not confirmed');
 };
 for(let i=0;i<resourceLimits.snapshotUpdates;i++){
  const semantic=createHash('sha256').update('controlled benchmark state '+i).digest('hex'),receipt=createHash('sha256').update(deployment+' receipt '+i).digest('hex');
  // Preserve the real bundle inputs/IDs, but vary benchmark metadata to avoid identical-value deduplication.
  const value=gzipSync(JSON.stringify({benchmarkReceipt:receipt,...packed})).toString('base64');maxPairValueBytes=Math.max(maxPairValueBytes,Buffer.byteLength(value));
  if(Buffer.byteLength(value)>65536)throw Error('Pair value exceeds benchmark cap');
  await store(['EVAL',lua,5,...keys,head,semantic,receipt,value,Date.now(),resourceLimits.maxPairs,resourceLimits.logicalByteLimit,resourceLimits.ttlSeconds],receipt,i%4===3);
 }
 await call('SET',prefix+'display',display,'EX',resourceLimits.ttlSeconds);
 // Stable-state polling reads the head and makes no retention write.
 for(let i=0;i<100;i++){const current=JSON.parse(String(await call('GET',keys[0])));if(current.id!==head)throw Error('Stable head changed');}
 const visitorLatencies:number[]=[];
 for(let batch=0;batch<resourceLimits.visitorReads/resourceLimits.concurrency;batch++)await Promise.allSettled(Array.from({length:resourceLimits.concurrency},async()=>{const t=performance.now(),value=await call('GET',prefix+'display');if(value!==display)throw Error('Cache read mismatch');visitorLatencies.push(performance.now()-t);reads++;}));
 if(reads!==resourceLimits.visitorReads)throw Error('Incomplete cache workload');
 const retained=Number(await call('HLEN',keys[4]));if(retained!==resourceLimits.maxPairs)throw Error('Retained receipts mismatch');
 const logicalBytes=Number(await call('GET',keys[3]));if(!Number.isSafeInteger(logicalBytes)||logicalBytes>resourceLimits.logicalByteLimit)throw Error('Logical storage cap exceeded');
 let measuredMemoryBytes:number|null=0;
 try{for(const key of [...keys,prefix+'display',prefix+'once']){const value=Number(await call('MEMORY','USAGE',key));if(!Number.isFinite(value)||value<=0)throw Error('Memory measurement unavailable');measuredMemoryBytes+=value;}}catch{measuredMemoryBytes=null;}
 const p=(values:number[],q:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*q))];
 return {status:'completed',observedAt:new Date().toISOString(),fixtureSha256:benchmarkFixtureSha256,limits:resourceLimits,namespace:prefix,snapshotUpdates:stored,confirmedScriptReads,confirmedScriptMutations,ambiguousScriptAttempts,mutationBudgetReserved:mutationReserved,mutationLimit:resourceLimits.mutationLimit,commandAttempts:commandAttempts+12,cachedReadAttempts,uniquePayloadVariants:stored,maxPairValueBytes,retainedPairs:retained,logicalStorageBytes:logicalBytes,measuredMemoryBytes,cachedDisplayValueBytes:Buffer.byteLength(display),controlledResponseLossRetries:controlledRetries,realTransportRetries:transportRetries,exactReceiptsRecovered:recovered,visitorCacheReads:reads,visitorConcurrency:resourceLimits.concurrency,visitorReadP50Ms:p(visitorLatencies,.5),visitorReadP95Ms:p(visitorLatencies,.95),commandRoundTripP95Ms:p(latencies,.95),reservedCommandCost:reserved,timing,expiry,additionalSchedules:0,notificationCalls:0,productionActivationPermitted:false,limitations:['Controlled response-loss retries are simulations on the chosen transport, not evidence of a real provider outage.','A Redis cache-read load is not a complete website/CDN visitor benchmark.','Reserved command cost and logical bytes are not provider-invoice measurements.']};
 }finally{
  // Retry expiry even after an ambiguous/partial script failure; never delete app data.
  // Twelve commands are reserved above, outside the work/deadline envelope.
  expiry.attempted=true;const cleanupKeys=[...keys,prefix+'display'];
  const expires=await Promise.allSettled(cleanupKeys.map(k=>redis('EXPIRE',k,resourceLimits.ttlSeconds)));
  const checks=await Promise.allSettled(cleanupKeys.map(k=>redis('TTL',k)));
  expiry.verified=expires.every(r=>r.status==='fulfilled')&&checks.every(r=>r.status==='fulfilled'&&(Number(r.value)===-2||(Number(r.value)>0&&Number(r.value)<=resourceLimits.ttlSeconds)));
  const used=process.cpuUsage(cpu);timing.cpuMs=(used.user+used.system)/1000;timing.wallMs=performance.now()-started;
  if(!expiry.verified)throw Error('Benchmark expiry not verified; inspect isolated namespace');
 }
}
/** Reads existing integration credentials only after the disabled Preview gate opens. */
export function hostedBenchmarkRedis(){
 const base=process.env.FOURTH_DOWN_BENCHMARK_REDIS_URL,token=process.env.FOURTH_DOWN_BENCHMARK_REDIS_TOKEN;
 if(process.env.FOURTH_DOWN_BENCHMARK_ISOLATION_VERIFIED!=='true')throw Error('Verified isolated database or namespace-restricted ACL required');
 if(!base||!token)throw Error('Existing Preview storage integration unavailable');
 const url=new URL(base);if(url.protocol!=='https:'||!url.hostname.endsWith('.upstash.io')||url.username||url.password||url.search||url.hash||url.port)throw Error('Invalid integration endpoint');
 const wire={httpCalls:0,requestBodyBytes:0,responseBodyBytes:0};
 const command:BenchmarkRedis=async(...cmd)=>{const body=JSON.stringify(cmd);wire.httpCalls++;wire.requestBodyBytes+=Buffer.byteLength(body);const r=await fetch(base,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body,cache:'no-store',signal:AbortSignal.timeout(5000)});const text=await r.text();wire.responseBodyBytes+=Buffer.byteLength(text);if(!r.ok)throw Error('Benchmark storage request failed');const result=JSON.parse(text);if(result.error)throw Error('Benchmark storage command unavailable');return result.result;};
 return {command,wire};
}
