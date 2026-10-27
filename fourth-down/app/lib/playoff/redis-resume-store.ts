import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {emptyPipelineState,pipelineLimits,type PipelineState,type ResumeStore} from './resume-pipeline.ts';
import {hash} from './engine.ts';
export type PrivateRedisPort=(...command:(string|number)[])=>Promise<unknown>;
/** Not connected to any deployment. Two declared keys; atomic quota + CAS candidate.
 * Costs reserve EVAL itself and all nested commands before state mutations. */
export const resumeTransactionScript=`
if #KEYS~=3 or not string.match(KEYS[1],'^fd:{resume%-private%-[a-f0-9]+}:state$') or KEYS[2]~=string.gsub(KEYS[1],':state$',':meter') or KEYS[3]~=string.gsub(KEYS[1],':state$',':display') then return redis.error_reply('Private keys required') end
local mode,expected,value,day,month,display=ARGV[1],ARGV[2],ARGV[3],ARGV[4],ARGV[5],ARGV[6]
if (mode~='read' and mode~='view' and mode~='commit') or #day~=10 or #month~=7 or #value>8389632 or #display>2097152 then return redis.error_reply('Invalid transaction') end
local commandCost=mode=='commit' and 7 or (mode=='view' and 6 or 5);local mutationCost=mode=='commit' and 3 or 1
local rawMeter=redis.call('GET',KEYS[2]);local meter={day=day,month=month,dc=0,dm=0,mc=0,mm=0,db=0,mb=0,dv=0}
if rawMeter then local ok,m=pcall(cjson.decode,rawMeter);if not ok then return redis.error_reply('Corrupt quota') end;meter=m end
if day<meter.day or month<meter.month then return redis.error_reply('Quota clock regressed') end
if meter.day~=day then meter.day=day;meter.dc=0;meter.dm=0;meter.db=0;meter.dv=0 end
if meter.month~=month then meter.month=month;meter.mc=0;meter.mm=0;meter.mb=0 end
if meter.dc+commandCost>5000 or meter.dm+mutationCost>2500 or meter.mc+commandCost>100000 or meter.mm+mutationCost>50000 then return {'limited'} end
if mode=='view' and meter.dv>=300 then return {'limited'} end
local current=redis.call('GET',mode=='view' and KEYS[3] or KEYS[1]) or ''
if string.find(current,'[^%w%+%/=]') or string.find(value,'[^%w%+%/=]') or string.find(display,'[^%w%+%/=]') then return redis.error_reply('Base64 transport required') end
local transferReserve=16384+(mode=='commit' and (#value+#display) or #current)
if meter.db+transferReserve>250000000 or meter.mb+transferReserve>2000000000 then return {'limited'} end
if mode=='commit' and (#value==0 or #expected~=40) then return redis.error_reply('Invalid commit') end
meter.dc=meter.dc+commandCost;meter.dm=meter.dm+mutationCost;meter.mc=meter.mc+commandCost;meter.mm=meter.mm+mutationCost;meter.db=meter.db+transferReserve;meter.mb=meter.mb+transferReserve;if mode=='view' then meter.dv=meter.dv+1 end
redis.call('SET',KEYS[2],cjson.encode(meter),'EX',3024000)
if mode=='view' then return {'read',current,redis.sha1hex(current),redis.sha1hex(redis.call('GET',KEYS[1]) or '')} end
if mode=='read' then return {'read',current,redis.sha1hex(current)} end
if redis.sha1hex(current)~=expected then return {'stale'} end
redis.call('SET',KEYS[1],value,'EX',3024000)
redis.call('SET',KEYS[3],display,'EX',900)
return {'committed'}
`;
/** Transport must be separately isolated and authorized. This module reads no env or credentials. */
export class RedisResumeStore implements ResumeStore{
 readonly redis:PrivateRedisPort;readonly namespace:string;readonly now:()=>number;
 constructor(redis:PrivateRedisPort,namespace:string,now=Date.now){if(!/^fd:\{resume-private-[a-f0-9]{16,64}\}:$/.test(namespace))throw Error('Explicit isolated private namespace required');this.redis=redis;this.namespace=namespace;this.now=now;}
 async readDisplay(){
  const at=new Date(this.now()).toISOString();const reply=await this.redis('EVAL',resumeTransactionScript,3,this.namespace+'state',this.namespace+'meter',this.namespace+'display','view','','',at.slice(0,10),at.slice(0,7),'');
  if(!Array.isArray(reply)||reply[0]!=='read')throw Error('Shared display quota unavailable');if(!reply[1])return null;const raw=String(reply[1]);if(createHash('sha1').update(raw).digest('hex')!==reply[2])throw Error('Display transport identity mismatch');const d=JSON.parse(gunzipSync(Buffer.from(raw,'base64'),{maxOutputLength:2*1024*1024}).toString());if(d.packet.schema!==1||hash({packet:d.packet,stateDigest:d.stateDigest})!==d.checksum||d.stateDigest!==reply[3])throw Error('Shared display integrity failed');return d.packet;
 }
 async transaction<T>(operation:(state:PipelineState)=>T):Promise<T>{
  const at=new Date(this.now()).toISOString(),day=at.slice(0,10),month=at.slice(0,7),keys=[this.namespace+'state',this.namespace+'meter',this.namespace+'display'];
  const invoke=(mode:string,expected='',value='',display='')=>this.redis('EVAL',resumeTransactionScript,3,...keys,mode,expected,value,day,month,display);
  // No unbounded retries and no transparent write retries after a lost response.
  const reply=await invoke('read');if(!Array.isArray(reply)||reply[0]!=='read')throw Error('Private shared quota/read unavailable');
  const raw=String(reply[1]),digest=String(reply[2]);if(createHash('sha1').update(raw).digest('hex')!==digest)throw Error('Private read receipt mismatch');
  let state=emptyPipelineState();if(raw){const d=JSON.parse(gunzipSync(Buffer.from(raw,'base64'),{maxOutputLength:pipelineLimits.stateBytes+1024}).toString());if(d.checksum!==hash(d.state)||d.state.schema!==1)throw Error('Private Redis state integrity failed');state=d.state;}
  const result=operation(state);if(result&&typeof (result as {then?:unknown}).then==='function')throw Error('Async callbacks forbidden');
  const json=JSON.stringify({checksum:hash(state),state});if(Buffer.byteLength(json)>pipelineLimits.stateBytes+1024)throw Error('Private Redis state cap exceeded');
  const value=gzipSync(json).toString('base64');
  if(raw&&value===raw)return structuredClone(result);
  const packet={schema:1,revision:state.revision,sourceSignature:state.sourceSignature,checkedAt:state.checkedAt,status:state.status,issues:state.issues,view:state.view,history:state.history.map(e=>({id:e.id,at:e.at}))};const stateDigest=createHash('sha1').update(value).digest('hex');const display=gzipSync(JSON.stringify({checksum:hash({packet,stateDigest}),packet,stateDigest})).toString('base64');
  const committed=await invoke('commit',digest,value,display);if(!Array.isArray(committed)||committed[0]!=='committed')throw Error('Private CAS conflict or shared quota exhausted; retry only from a new verified tick');
  return structuredClone(result);
 }
}
