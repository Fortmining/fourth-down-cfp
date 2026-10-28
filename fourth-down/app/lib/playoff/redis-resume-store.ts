import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {emptyPipelineState,pipelineLimits,type PipelineState,type ResumeStore} from './resume-pipeline.ts';
import {hash} from './engine.ts';
export type PrivateRedisPort=(...command:(string|number)[])=>Promise<unknown>;
/** Not connected to any deployment. Four declared keys; atomic quota + CAS candidate.
 * Costs reserve EVAL itself and all nested commands before state mutations. */
export const resumeRedisProtocolVersion=2;
export const resumeTransactionScript=`
if #KEYS~=4 or not string.match(KEYS[1],'^fd:{resume%-private%-[a-f0-9]+}:state$') or KEYS[2]~=string.gsub(KEYS[1],':state$',':meter') or KEYS[3]~=string.gsub(KEYS[1],':state$',':display') or KEYS[4]~=string.gsub(KEYS[1],':state$',':head') then return redis.error_reply('Private keys required') end
local mode,expected,value,day,month,display,head=ARGV[1],ARGV[2],ARGV[3],ARGV[4],ARGV[5],ARGV[6],ARGV[7]
if (mode~='read' and mode~='view' and mode~='commit' and mode~='fresh') or #day~=10 or #month~=7 or #value>8389632 or #display>2097152 or #head>4096 then return redis.error_reply('Invalid transaction') end
local commandCost=mode=='commit' and 9 or ((mode=='view' or mode=='fresh') and 7 or 5);local mutationCost=mode=='commit' and 4 or (mode=='fresh' and 2 or 1)
local rawMeter=redis.call('GET',KEYS[2]);local meter={day=day,month=month,dc=0,dm=0,mc=0,mm=0,db=0,mb=0,dv=0}
if rawMeter then local ok,m=pcall(cjson.decode,rawMeter);if not ok or type(m)~='table' then return redis.error_reply('Corrupt quota') end;meter=m end
if day<meter.day or month<meter.month then return redis.error_reply('Quota clock regressed') end
if meter.day~=day then meter.day=day;meter.dc=0;meter.dm=0;meter.db=0;meter.dv=0 end
if meter.month~=month then meter.month=month;meter.mc=0;meter.mm=0;meter.mb=0 end
if meter.dc+commandCost>5000 or meter.dm+mutationCost>2500 or meter.mc+commandCost>100000 or meter.mm+mutationCost>50000 then return {'limited'} end
if mode=='view' and meter.dv>=300 then return {'limited'} end
local current=redis.call('GET',mode=='view' and KEYS[3] or (mode=='fresh' and KEYS[4] or KEYS[1])) or ''
if (mode~='fresh' and string.find(current,'[^%w%+%/=]')) or string.find(value,'[^%w%+%/=]') or string.find(display,'[^%w%+%/=]') then return redis.error_reply('Base64 transport required') end
local transferReserve=16384+(mode=='commit' and (#value+#display) or (mode=='fresh' and #head+#current or #current))
if meter.db+transferReserve>250000000 or meter.mb+transferReserve>2000000000 then return {'limited'} end
if mode=='commit' and (#value==0 or #expected~=40 or #head==0) then return redis.error_reply('Invalid commit') end
meter.dc=meter.dc+commandCost;meter.dm=meter.dm+mutationCost;meter.mc=meter.mc+commandCost;meter.mm=meter.mm+mutationCost;meter.db=meter.db+transferReserve;meter.mb=meter.mb+transferReserve;if mode=='view' then meter.dv=meter.dv+1 end
redis.call('SET',KEYS[2],cjson.encode(meter),'EX',3024000)
if mode=='view' then return {'read',current,redis.sha1hex(current),redis.sha1hex(redis.call('GET',KEYS[1]) or ''),redis.call('GET',KEYS[4]) or ''} end
if mode=='fresh' then
 local ok,h=pcall(cjson.decode,current);local valid,p=pcall(cjson.decode,head)
 if not ok or not valid or type(h)~='table' or type(p)~='table' or h.protocol~=2 or h.status~='ready' or h.signature~=p.signature or type(h.checkedAt)~='string' or type(p.checkedAt)~='string' or p.checkedAt<h.checkedAt then return {'refresh-required'} end
 local actual=redis.sha1hex(redis.call('GET',KEYS[1]) or '')
 if h.stateDigest~=actual or redis.call('EXISTS',KEYS[3])~=1 then return {'refresh-required'} end
 h.checkedAt=p.checkedAt;redis.call('SET',KEYS[4],cjson.encode(h),'EX',3024000)
 return {'fresh'}
end
if mode=='read' then return {'read',current,redis.sha1hex(current),redis.call('GET',KEYS[4]) or ''} end
if redis.sha1hex(current)~=expected then return {'stale'} end
local priorHead=redis.call('GET',KEYS[4]);local valid,nextHead=pcall(cjson.decode,head)
if not valid or type(nextHead)~='table' or nextHead.protocol~=2 then return redis.error_reply('Invalid head') end
if priorHead then local ok,prior=pcall(cjson.decode,priorHead);if not ok or type(prior)~='table' then return redis.error_reply('Corrupt head') end;if type(prior.checkedAt)=='string' and (type(nextHead.checkedAt)~='string' or nextHead.checkedAt<prior.checkedAt) then return {'stale'} end end
redis.call('SET',KEYS[1],value,'EX',3024000)
redis.call('SET',KEYS[3],display,'EX',3024000)
redis.call('SET',KEYS[4],head,'EX',3024000)
return {'committed'}
`;
/** Transport must be separately isolated and authorized. This module reads no env or credentials. */
export class RedisResumeStore implements ResumeStore{
 readonly redis:PrivateRedisPort;readonly namespace:string;readonly now:()=>number;
 constructor(redis:PrivateRedisPort,namespace:string,now=Date.now){if(!/^fd:\{resume-private-[a-f0-9]{16,64}\}:$/.test(namespace))throw Error('Explicit isolated private namespace required');this.redis=redis;this.namespace=namespace;this.now=now;}
 async renewVerifiedFreshness(signature:string,checkedAt:string){
  const now=this.now(),at=new Date(now).toISOString(),check=Date.parse(checkedAt);
  if(!/^[a-f0-9]{64}$/.test(signature)||!Number.isFinite(check)||check>now||now-check>pipelineLimits.sourceAgeMs)throw Error('Invalid verified freshness receipt');
  const reply=await this.redis('EVAL',resumeTransactionScript,4,this.namespace+'state',this.namespace+'meter',this.namespace+'display',this.namespace+'head','fresh','','',at.slice(0,10),at.slice(0,7),'',JSON.stringify({signature,checkedAt:new Date(check).toISOString()}));
  if(!Array.isArray(reply))throw Error('Freshness protocol unavailable');
  if(reply[0]==='limited')throw Error('Freshness quota unavailable');
  return reply[0]==='fresh';
 }
 async readDisplay(){
  const at=new Date(this.now()).toISOString();const reply=await this.redis('EVAL',resumeTransactionScript,4,this.namespace+'state',this.namespace+'meter',this.namespace+'display',this.namespace+'head','view','','',at.slice(0,10),at.slice(0,7),'','');
  if(!Array.isArray(reply)||reply[0]!=='read')throw Error('Shared display quota unavailable');if(!reply[1])return null;const raw=String(reply[1]);if(createHash('sha1').update(raw).digest('hex')!==reply[2])throw Error('Display transport identity mismatch');const d=JSON.parse(gunzipSync(Buffer.from(raw,'base64'),{maxOutputLength:2*1024*1024}).toString());if(d.packet.schema!==1||hash({packet:d.packet,stateDigest:d.stateDigest})!==d.checksum||d.stateDigest!==reply[3])throw Error('Shared display integrity failed');const head=JSON.parse(String(reply[4]));if(head.protocol!==resumeRedisProtocolVersion||head.stateDigest!==d.stateDigest||head.signature!==d.packet.sourceSignature||head.status!==d.packet.status||(head.checkedAt!==null&&(typeof head.checkedAt!=='string'||!Number.isFinite(Date.parse(head.checkedAt))||Date.parse(head.checkedAt)<Date.parse(d.packet.checkedAt??head.checkedAt)))||(head.checkedAt===null&&d.packet.checkedAt!==null))throw Error('Shared freshness identity mismatch');return {...d.packet,checkedAt:head.checkedAt};
 }
 async transaction<T>(operation:(state:PipelineState)=>T):Promise<T>{
  const at=new Date(this.now()).toISOString(),day=at.slice(0,10),month=at.slice(0,7),keys=[this.namespace+'state',this.namespace+'meter',this.namespace+'display',this.namespace+'head'];
  const invoke=(mode:string,expected='',value='',display='',head='')=>this.redis('EVAL',resumeTransactionScript,4,...keys,mode,expected,value,day,month,display,head);
  // No unbounded retries and no transparent write retries after a lost response.
  const reply=await invoke('read');if(!Array.isArray(reply)||reply[0]!=='read')throw Error('Private shared quota/read unavailable');
  const raw=String(reply[1]),digest=String(reply[2]);if(createHash('sha1').update(raw).digest('hex')!==digest)throw Error('Private read receipt mismatch');
  let state=emptyPipelineState();if(raw){const d=JSON.parse(gunzipSync(Buffer.from(raw,'base64'),{maxOutputLength:pipelineLimits.stateBytes+1024}).toString());if(d.checksum!==hash(d.state)||d.state.schema!==1)throw Error('Private Redis state integrity failed');state=d.state;}
  // A read after compact renewal must preserve its verified freshness, including
  // bookkeeping/history transactions. A delayed read still carries its OLD head
  // and cannot pass the commit's monotonic checkpoint guard.
  if(reply[3]){const head=JSON.parse(String(reply[3]));if(head.protocol===2&&head.stateDigest===digest&&head.signature===state.sourceSignature&&head.status===state.status&&typeof head.checkedAt==='string'&&Number.isFinite(Date.parse(head.checkedAt))&&Date.parse(head.checkedAt)>=Date.parse(state.checkedAt??head.checkedAt))state.checkedAt=head.checkedAt;}
  const result=operation(state);if(result&&typeof (result as {then?:unknown}).then==='function')throw Error('Async callbacks forbidden');
  const json=JSON.stringify({checksum:hash(state),state});if(Buffer.byteLength(json)>pipelineLimits.stateBytes+1024)throw Error('Private Redis state cap exceeded');
  const value=gzipSync(json).toString('base64');
  if(raw&&value===raw)return structuredClone(result);
  const packet={schema:1,revision:state.revision,sourceSignature:state.sourceSignature,checkedAt:state.checkedAt,status:state.status,issues:state.issues,view:state.view,history:state.history.map(e=>({id:e.id,at:e.at}))};const stateDigest=createHash('sha1').update(value).digest('hex');const display=gzipSync(JSON.stringify({checksum:hash({packet,stateDigest}),packet,stateDigest})).toString('base64');
  const committed=await invoke('commit',digest,value,display,JSON.stringify({protocol:resumeRedisProtocolVersion,stateDigest,signature:state.sourceSignature,status:state.status,checkedAt:state.checkedAt?new Date(state.checkedAt).toISOString():null}));if(!Array.isArray(committed)||committed[0]!=='committed')throw Error('Private CAS conflict or shared quota exhausted; retry only from a new verified tick');
  return structuredClone(result);
 }
}
