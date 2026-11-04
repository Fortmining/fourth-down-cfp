import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {resumeTransactionScript,type PrivateRedisPort} from './redis-resume-store.ts';

/** Offline preparation only. One credentialed supervisor; workers get no transport.
 * This file is never a Vercel route or a distributed/cloud budget service. */
export const integrationTestLimits=Object.freeze({
 commands:2400,mutations:900,reads:1200,attempts:320,recoveries:3,
 wireBytes:160*1024*1024,ttlSeconds:3600,workDeadlineMs:600000,
 stateBytes:1024*1024,displayBytes:128*1024,headBytes:4096,
 setup:{commands:16,mutations:8,reads:8,attempts:16,wireBytes:65536},
 cleanup:{commands:32,mutations:16,reads:16,attempts:24,wireBytes:131072},
});
export type Cost={commands:number;mutations:number;reads:number;attempts:number;wireBytes:number;recoveries:number};
type Phase='setup'|'work'|'cleanup';
const zero=():Cost=>({commands:0,mutations:0,reads:0,attempts:0,wireBytes:0,recoveries:0});
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const seal=sha(JSON.stringify(integrationTestLimits));
export class IntegrationBudgetStop extends Error{}
function check(condition:unknown,message:string):asserts condition{if(!condition)throw new IntegrationBudgetStop(message);}
/** Append+fsync reservations before I/O. No refund on failure or ambiguous replies.
 * Separate processes must use this SAME canonical root/run ID. A second controller
 * or cloud worker with direct credentials is explicitly outside the test design. */
export class IntegrationTestBudget{
 readonly file:string;readonly lock:string;readonly runId:string;readonly namespace:string;
 constructor(root:string,runId:string,create=false){
  check(/^[a-f0-9]{24}$/.test(runId),'Fixed approved run identity required');
  this.runId=runId;this.namespace=`fd:{resume-private-${runId}}:`;
  fs.mkdirSync(root,{recursive:true,mode:0o700});const canonical=fs.realpathSync(root);
  this.file=path.join(canonical,runId+'.jsonl');this.lock=this.file+'.lock';
  if(create){const fd=fs.openSync(this.file,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify({schema:1,runId,seal,startedAt:new Date().toISOString()})+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}const dir=fs.openSync(canonical,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}
  this.snapshot();
 }
 private read(){
  check(fs.statSync(this.file).size<=256*1024,'Budget journal oversized');
  const raw=fs.readFileSync(this.file,'utf8');check(raw.endsWith('\n'),'Interrupted journal; manual recovery required');
  const lines=raw.trimEnd().split('\n'),header=JSON.parse(lines.shift()!);
  check(header.schema===1&&header.runId===this.runId&&header.seal===seal&&Number.isFinite(Date.parse(header.startedAt)),'Budget manifest changed');
  let previous=sha(JSON.stringify(header));const total=zero(),phases={setup:zero(),work:zero(),cleanup:zero()},ids=new Set<string>();
  for(const line of lines){const entry=JSON.parse(line),{digest,...record}=entry;check(record.previous===previous&&digest===sha(JSON.stringify(record)),'Budget journal corrupt');check(!ids.has(record.id),'Duplicate reservation');ids.add(record.id);previous=digest;
   check(['setup','work','cleanup'].includes(record.phase),'Invalid phase');for(const k of Object.keys(total) as (keyof Cost)[]){check(Number.isSafeInteger(record.cost[k])&&record.cost[k]>=0,'Invalid reservation');total[k]+=record.cost[k];phases[record.phase as Phase][k]+=record.cost[k];}
  }
  return {total,phases,ids,previous,startedAt:header.startedAt};
 }
 snapshot(){const s=this.read();return {total:s.total,phases:s.phases,limits:integrationTestLimits,namespace:this.namespace};}
 reserve(id:string,cost:Cost,phase:Phase='work'){
  check(/^[a-zA-Z0-9_-]{1,100}$/.test(id),'Reservation identity required');
  // Lock contention fails closed; no uncounted Redis request or spin retry.
  const fd=fs.openSync(this.lock,'wx',0o600);
  try{
   const s=this.read();if(phase!=='cleanup')check(Date.now()>=Date.parse(s.startedAt)&&Date.now()-Date.parse(s.startedAt)<=integrationTestLimits.workDeadlineMs,'Work deadline exhausted; cleanup only');check(!s.ids.has(id),'Ticket already consumed; never replay it');
   for(const k of Object.keys(s.total) as (keyof Cost)[]){check(Number.isSafeInteger(cost[k])&&cost[k]>=0,'Invalid cost');const cap=integrationTestLimits[k];check(s.total[k]+cost[k]<=cap,'Whole-run '+k+' cap exhausted');}
   for(const k of ['commands','mutations','reads','attempts','wireBytes'] as const){
    const cap=phase==='work'?integrationTestLimits[k]-integrationTestLimits.setup[k]-integrationTestLimits.cleanup[k]:integrationTestLimits[phase][k];
    check(s.phases[phase][k]+cost[k]<=cap,phase+' '+k+' allowance exhausted');
   }
   const record={id,phase,cost,previous:s.previous},line=JSON.stringify({...record,digest:sha(JSON.stringify(record))})+'\n';
   const journal=fs.openSync(this.file,'a',0o600);try{fs.writeFileSync(journal,line);fs.fsyncSync(journal);}finally{fs.closeSync(journal);}
  }finally{fs.closeSync(fd);fs.unlinkSync(this.lock);}
 }
 recovery(id:string){this.reserve(id,{...zero(),recoveries:1});}
}

export const protocolOperationCost=Object.freeze({read:{commands:5,mutations:2,reads:3},commit:{commands:9,mutations:5,reads:3},fresh:{commands:7,mutations:3,reads:4},view:{commands:7,mutations:2,reads:4}});
/** Write charges conservatively count EVAL itself AND every nested write.
 * Guard every nested Redis call BEFORE execution. Lua errors/lost replies retain
 * the full outer reservation. No pipeline, alternate script, scan or app key. */
export function guardedIntegrationScript(namespace:string,mode:keyof typeof protocolOperationCost){
 check(/^fd:\{resume-private-[a-f0-9]{24}\}:$/.test(namespace),'Isolated test namespace required');const c=protocolOperationCost[mode];
 return `local backend=redis;local calls,reads,mutations=0,0,0
local allowed={['${namespace}state']=true,['${namespace}meter']=true,['${namespace}display']=true,['${namespace}head']=true}
local redis={error_reply=backend.error_reply,sha1hex=backend.sha1hex}
redis.call=function(op,key,...)
 if not allowed[key] then error('Foreign key rejected') end
 local r=(op=='GET' or op=='EXISTS') and 1 or 0;local m=op=='SET' and 1 or 0
 if r+m~=1 then error('Command rejected') end
 if calls+1>${c.commands-1} or reads+r>${c.reads} or mutations+m>${c.mutations-1} then error('Nested command cap') end
 calls=calls+1;reads=reads+r;mutations=mutations+m
 local args={...}
 if op=='SET' then
  local cap=key=='${namespace}state' and ${integrationTestLimits.stateBytes} or (key=='${namespace}display' and ${integrationTestLimits.displayBytes} or ${integrationTestLimits.headBytes})
  if type(args[1])~='string' or #args[1]>cap or args[2]~='EX' or #args~=3 then error('Value/expiry rejected') end
  args[3]=${integrationTestLimits.ttlSeconds}
 end
 local value=backend.call(op,key,unpack(args))
 if op=='GET' and value then local cap=key=='${namespace}state' and ${integrationTestLimits.stateBytes} or (key=='${namespace}display' and ${integrationTestLimits.displayBytes} or ${integrationTestLimits.headBytes});if #value>cap then error('Oversized isolated value') end end
 return value
end
local function operation()\n${resumeTransactionScript}\nend
local result=operation();return {result,calls+1,reads,mutations+1}`;
}
/** Sole owner wraps an injected port; this module reads no credentials or env.
 * Deployment workers may not instantiate this with a raw credential/transport. */
export function boundedIntegrationPort(budget:IntegrationTestBudget,transport:PrivateRedisPort){
 let sequence=0;const measured={attempts:0,commands:0,reads:0,mutations:0,ambiguous:0,receivedBytes:0};
 const allowed=['state','meter','display','head'].map(k=>budget.namespace+k);
 const ticket=()=>`attempt_${process.pid}_${Date.now()}_${sequence++}`;
 const port:PrivateRedisPort=async(...cmd)=>{
  check(cmd[0]==='EVAL'&&cmd[1]===resumeTransactionScript&&cmd[2]===4&&JSON.stringify(cmd.slice(3,7))===JSON.stringify(allowed)&&cmd.length===14,'Only exact protocol-2 operations accepted');
  const mode=String(cmd[7]) as keyof typeof protocolOperationCost,c=protocolOperationCost[mode];check(c,'Unsupported mode');
  check(/^(?:[a-f0-9]{40})?$/.test(String(cmd[8]))&&/^\d{4}-\d{2}-\d{2}$/.test(String(cmd[10]))&&String(cmd[11])===String(cmd[10]).slice(0,7),'Invalid protocol header');
  check(Buffer.byteLength(String(cmd[9]))<=integrationTestLimits.stateBytes&&Buffer.byteLength(String(cmd[12]))<=integrationTestLimits.displayBytes&&Buffer.byteLength(String(cmd[13]))<=integrationTestLimits.headBytes,'Request value cap');
  const command=[...cmd];command[1]=guardedIntegrationScript(budget.namespace,mode);
  const responseBound=mode==='read'?integrationTestLimits.stateBytes+8192:mode==='view'?integrationTestLimits.displayBytes+8192:1024;
  const wireBytes=Buffer.byteLength(JSON.stringify(command))+responseBound+4096;
  budget.reserve(ticket(),{...c,attempts:1,wireBytes,recoveries:0});measured.attempts++;
  try{
   const reply=await transport(...command);check(Array.isArray(reply)&&reply.length===4,'Accounting response missing');
   const [,commands,reads,mutations]=reply;check([commands,reads,mutations].every(Number.isSafeInteger)&&Number(commands)>=1&&Number(commands)<=c.commands&&Number(reads)>=0&&Number(reads)<=c.reads&&Number(mutations)>=0&&Number(mutations)<=c.mutations,'Nested accounting mismatch');
   const bytes=Buffer.byteLength(JSON.stringify(reply));check(bytes<=responseBound,'Response cap exceeded');measured.commands+=Number(commands);measured.reads+=Number(reads);measured.mutations+=Number(mutations);measured.receivedBytes+=bytes;return reply[0];
  }catch(error){measured.ambiguous++;throw error;}
 };
 const cleanup=async()=>{
  const results=[];
  for(const key of allowed){
   let expired=false;for(let n=0;n<2&&!expired;n++){
    budget.reserve(ticket(),{commands:1,mutations:1,reads:0,attempts:1,wireBytes:4096,recoveries:0},'cleanup');
    try{const result=await transport('EXPIRE',key,1);expired=result===1||result===0;}catch{/* Both attempts are reserved; one-hour TTL is the backstop. */}
   }
   budget.reserve(ticket(),{commands:1,mutations:0,reads:1,attempts:1,wireBytes:4096,recoveries:0},'cleanup');
   try{const ttl=await transport('TTL',key);results.push({key,expiryConfirmed:expired&&(ttl===-2||ttl===0||ttl===1)});}catch{results.push({key,expiryConfirmed:false});}
  }
  return {results,complete:results.every(r=>r.expiryConfirmed)};
 };
 const verifyExpired=async()=>{
  const results=[];for(const key of allowed){budget.reserve(ticket(),{commands:1,mutations:0,reads:1,attempts:1,wireBytes:4096,recoveries:0},'cleanup');try{results.push({key,absent:await transport('TTL',key)===-2});}catch{results.push({key,absent:false});}}
  return {results,complete:results.every(r=>r.absent)};
 };
 const verifyRevoked=async()=>{
  budget.reserve(ticket(),{commands:1,mutations:0,reads:1,attempts:1,wireBytes:4096,recoveries:0},'cleanup');
  try{await transport('TTL',allowed[0]);return false;}catch(error){return (error as {authorizationDenied?:boolean}).authorizationDenied===true;}
 };
 const verifyIsolation=async()=>{
  // Never probe an existing application key. This absent canary is outside all
  // four approved key patterns; both direct and nested access must be denied.
  const canary=`fd:{resume-isolation-canary-${budget.runId}}:never-created`;
  const probes=[['GET',canary],['EVAL',`return redis.call('GET','${canary}')`,4,...allowed]] as (string|number)[][];
  const allowedKeyResults=[];for(const key of allowed){budget.reserve(ticket(),{commands:1,mutations:0,reads:1,attempts:1,wireBytes:4096,recoveries:0},'setup');try{allowedKeyResults.push(await transport('TTL',key)===-2);}catch{allowedKeyResults.push(false);}}
  if(!allowedKeyResults.every(Boolean))return {inScopeEmpty:false,directDenied:false,nestedDenied:false,safe:false};
  const denied=[];for(let n=0;n<probes.length;n++){
   budget.reserve(ticket(),{commands:n?2:1,mutations:n?1:0,reads:1,attempts:1,wireBytes:8192,recoveries:0},'setup');
   try{await transport(...probes[n]);denied.push(false);}catch(error){denied.push((error as {authorizationDenied?:boolean}).authorizationDenied===true);}
  }
  return {inScopeEmpty:true,directDenied:denied[0],nestedDenied:denied[1],safe:denied.every(Boolean)};
 };
 return {port,cleanup,verifyExpired,verifyRevoked,verifyIsolation,measured};
}

/** Prepared, never invoked against a real endpoint during offline validation.
 * No SDK retries, redirects, environment lookup or credential-bearing return value. */
export function createPreparedIntegrationSupervisor(budget:IntegrationTestBudget,endpoint:string,credential:string,fetcher:typeof fetch=fetch,timeoutMs=8000){
 const url=new URL(endpoint);
 check(url.protocol==='https:'&&url.hostname.endsWith('.upstash.io')&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'Isolated Upstash HTTPS endpoint required');
 check(typeof credential==='string'&&credential.length>0&&credential.length<=4096&&!/\s/.test(credential),'Explicit temporary credential required');
 check(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=8000,'Bounded attempt deadline required');
 const network={requests:0,requestBytes:0,responseBytes:0,latenciesMs:[] as number[],timeouts:0,errors:[] as string[]};
 const transport:PrivateRedisPort=async(...command)=>{
  const started=performance.now();network.requests++;network.requestBytes+=Buffer.byteLength(JSON.stringify(command));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   // Exactly one application-level HTTP attempt. Every caller retry must re-enter
   // the durable budget gate. Fetch redirect following is explicitly disabled.
   const response=await fetcher(url.origin,{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify(command),redirect:'error',signal:controller.signal});
   if(response.status===401||response.status===403)throw Object.assign(Error('Authorization denied'),{authorizationDenied:true});
   const mode=String(command[7]),cap=command[0]!=='EVAL'?1024:mode==='read'?integrationTestLimits.stateBytes+8192:mode==='view'?integrationTestLimits.displayBytes+8192:1024;
   const reader=response.body?.getReader();check(reader,'Response body unavailable');let size=0;const parts:Uint8Array[]=[];
   while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;network.responseBytes+=next.value.length;if(size>cap){controller.abort();throw Error('Oversized response');}parts.push(next.value);}
   let data:{result?:unknown;error?:unknown};try{data=JSON.parse(Buffer.concat(parts).toString());}catch{throw Error('Invalid isolated response');}
   if(!response.ok||data.error){if(network.errors.length<10)network.errors.push(String(data.error??response.status).replaceAll(credential,'[credential]').replace(/[A-Za-z0-9_+\/=.-]{80,}/g,'[opaque]').slice(0,500));const denied=response.status===401||response.status===403||typeof data.error==='string'&&/WRONGPASS|NOPERM|unauthori[sz]ed/i.test(data.error);throw Object.assign(Error('Isolated request rejected'),{authorizationDenied:denied});}
   return data.result;
  }catch(error){throw Object.assign(Error('Isolated transport unavailable; reservation retained'),{authorizationDenied:(error as {authorizationDenied?:boolean}).authorizationDenied===true});}
  finally{if(controller.signal.aborted)network.timeouts++;network.latenciesMs.push(performance.now()-started);clearTimeout(timer);}
 };
 return {...boundedIntegrationPort(budget,transport),network};
}
