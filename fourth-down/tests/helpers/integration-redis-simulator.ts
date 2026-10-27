// Protocol simulator, NOT a Lua interpreter or a provider measurement.
import {createHash} from 'node:crypto';
import {guardedIntegrationScript} from '../../app/lib/playoff/integration-test-budget.ts';
import type {PrivateRedisPort} from '../../app/lib/playoff/redis-resume-store.ts';
export function integrationRedisSimulator(namespace:string){
 const values=new Map<string,string>(),expires=new Map<string,number>();let lose=0;const counters={attempts:0,commands:0,reads:0,mutations:0};
 const digest=(s:string)=>createHash('sha1').update(s).digest('hex');
 const port:PrivateRedisPort=async(...c)=>{
  counters.attempts++;
  if(c[0]==='EXPIRE'){counters.commands++;counters.mutations++;if(!values.has(String(c[1])))return 0;expires.set(String(c[1]),Date.now()+Number(c[2])*1000);return 1;}
  if(c[0]==='TTL'){counters.commands++;counters.reads++;if((expires.get(String(c[1]))??Infinity)<=Date.now()){values.delete(String(c[1]));expires.delete(String(c[1]));}return values.has(String(c[1]))?Math.max(0,Math.floor((expires.get(String(c[1]))!-Date.now())/1000)):-2;}
  if(c[0]!=='EVAL')throw Error('Unexpected simulated operation');const mode=String(c[7]) as 'read'|'view'|'fresh'|'commit';if(c[1]!==guardedIntegrationScript(namespace,mode))throw Error('Wrong guarded script');
  let commands=1,reads=0,mutations=0;
  const get=(k:string)=>{commands++;reads++;return values.get(k)??'';};const set=(k:string,v:string)=>{commands++;mutations++;values.set(k,v);expires.set(k,Date.now()+3600000);};
  get(namespace+'meter');const current=get(namespace+(mode==='view'?'display':mode==='fresh'?'head':'state'));set(namespace+'meter','simulated budget meter');let result:unknown;
  if(mode==='read')result=['read',current,digest(current),get(namespace+'head')];
  if(mode==='view')result=['read',current,digest(current),digest(get(namespace+'state')),get(namespace+'head')];
  if(mode==='fresh'){
   const h=current?JSON.parse(current):null,p=JSON.parse(String(c[13]));result=['refresh-required'];
   if(h&&h.protocol===2&&h.status==='ready'&&h.signature===p.signature&&h.checkedAt&&p.checkedAt>=h.checkedAt){const actual=digest(get(namespace+'state'));commands++;reads++;if(h.stateDigest===actual&&values.has(namespace+'display')){h.checkedAt=p.checkedAt;set(namespace+'head',JSON.stringify(h));result=['fresh'];}}
  }
  if(mode==='commit'){
   result=['stale'];if(String(c[8])===digest(current)){const priorRaw=get(namespace+'head'),prior=priorRaw?JSON.parse(priorRaw):null,next=JSON.parse(String(c[13]));if(!prior?.checkedAt||next.checkedAt>=prior.checkedAt){set(namespace+'state',String(c[9]));set(namespace+'display',String(c[12]));set(namespace+'head',String(c[13]));result=['committed'];}}
  }
  counters.commands+=commands;counters.reads+=reads;counters.mutations+=mutations+1;
  if(mode==='commit'&&lose>0&&--lose===0){throw Error('Simulated lost acknowledgement after commit');}
  return [result,commands,reads,mutations+1];
 };
 return {port,counters,values,expires,loseNextCommit:(after=1)=>{lose=after;}};
}
