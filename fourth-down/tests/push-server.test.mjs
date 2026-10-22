import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import * as alerts from '../app/lib/alerts.ts';
const require=createRequire(import.meta.url);
const env={UPSTASH_REDIS_REST_URL:'https://test-redis.invalid',UPSTASH_REDIS_REST_TOKEN:'test-only',VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test',VAPID_SUBJECT:'https://fourth-down-cfp.vercel.app',CRON_SECRET:'test-secret'};
function harness() {
 const values=new Map(),hashes=new Map();const sent=[];
 let feed={season:2026,updatedAt:new Date().toISOString(),games:[],polls:[]};
 const json=(body,init)=>new Response(JSON.stringify(body),{status:init?.status||200,headers:init?.headers});
 function command(args){
  const [raw,key,...rest]=args,op=raw.toUpperCase();
  if(op==='GET')return values.get(key)??null;
  if(op==='GETDEL'){const v=values.get(key)??null;values.delete(key);return v;}
  if(op==='SET'){if(rest.includes('NX')&&values.has(key))return null;values.set(key,rest[0]);return 'OK';}
  if(op==='INCR'){const next=Number(values.get(key)||0)+1;values.set(key,next);return next;}
  if(op==='EXPIRE')return 1;
  if(op==='EVAL'){values.delete(args[3]);return 1;}
  if(op==='HGET')return hashes.get(key)?.get(rest[0])??null;
  if(op==='HSET'||op==='HSETNX'){if(!hashes.has(key))hashes.set(key,new Map());const h=hashes.get(key);if(op==='HSETNX'&&h.has(rest[0]))return 0;h.set(rest[0],rest[1]);return 1;}
  if(op==='HDEL')return Number(hashes.get(key)?.delete(rest[0])||0);
  if(op==='HSCAN')return ['0',[...(hashes.get(key)||new Map()).entries()].flat()];
  throw Error(op);
 }
 function load(path,mapping={}){
  const exports={};const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{exports,process:{env:{...env}},Buffer,URL,Request,Response,AbortSignal,Date,console,
   fetch:async(_url,options)=>json({result:command(JSON.parse(options.body))}),
   require:name=>mapping[name]??(name.includes('lib/push-store')?store:name.includes('lib/alerts')||name==='./alerts'?alerts:name==='next/server'?{NextResponse:{json}}:require(name))});
  return exports;
 }
 const store=load('app/lib/push-store.ts');
 const subscription=load('app/api/alerts/subscription/route.ts');
 const config=load('app/api/alerts/config/route.ts');
 const dispatcher=load('app/api/alerts/dispatch/route.ts',{'../../live/route':{GET:async()=>json(feed)},'../../../data/confirmed-developments.json':[], 'web-push':{setVapidDetails(){},async sendNotification(s,payload){sent.push({s,payload:JSON.parse(payload)});}}});
 const sender={'web-push':{setVapidDetails(){},async sendNotification(s,payload){sent.push({s,payload:JSON.parse(payload)});}}};
 const testDelivery=load('app/api/alerts/test/route.ts',sender);
 const receipt=load('app/api/alerts/receipt/route.ts');
 return {testDelivery,receipt,store,subscription,config,dispatcher,values,hashes,sent,setFeed(next){feed=next;},command};
}
const request=(data,origin='https://fourth-down-cfp.vercel.app')=>new Request('https://fourth-down-cfp.vercel.app/api/alerts/subscription',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
const endpoint={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}};
const run=h=>h.dispatcher.GET(new Request('https://fourth-down-cfp.vercel.app/api/alerts/dispatch',{headers:{authorization:'Bearer test-secret'}}));
test('rejects private endpoints, credentials, malicious subdomains and cross-origin mutations',async()=>{
 const h=harness();assert.equal(h.store.validPushSubscription(endpoint),true);
 for(const url of ['https://localhost/foo','https://127.0.0.1','https://fcm.googleapis.com.evil.test/foo','http://fcm.googleapis.com/foo','https://user:pass@fcm.googleapis.com/foo','https://fcm.googleapis.com:444/foo'])assert.equal(h.store.validPushSubscription({...endpoint,endpoint:url}),false);
 assert.equal((await h.subscription.POST(request({action:'create',subscription:endpoint},'https://evil.test'))).status,403);
 assert.equal((await h.dispatcher.GET(new Request('https://example.test'))).status,401);
});
test('health remains unavailable until a protected scheduled baseline succeeds; subscriptions require capability for updates/deletes',async()=>{
 const h=harness();assert.equal((await(await h.config.GET()).json()).available,false);
 assert.equal((await h.subscription.POST(request({action:'create',subscription:endpoint}))).status,503);
 assert.equal((await run(h)).status,200);assert.equal((await(await h.config.GET()).json()).available,true);
 const result=await(await h.subscription.POST(request({action:'create',subscription:endpoint,preferences:alerts.defaultAlertPreferences()}))).json();
 assert.ok(result.token);assert.ok(result.id);
 assert.equal((await h.subscription.POST(request({action:'delete',id:result.id,token:'0'.repeat(64)}))).status,403);
 assert.equal((await h.subscription.POST(request({action:'delete',id:result.id,token:result.token}))).status,200);
 assert.equal((await h.subscription.POST(request({action:'delete',id:result.id,token:result.token}))).status,200);
});
test('protected dispatch coalesces favorite final and breaking upset, dedupes reruns and honors unsubscribe',async()=>{
 const h=harness();const baselineTime=Date.now()-60000;
 const game={id:'g1',name:'Favorite at Top Ten',date:new Date(baselineTime-300000).toISOString(),status:'in',providerStatus:'STATUS_IN_PROGRESS',completed:false,teams:[{id:'1',name:'Favorite',score:'31'},{id:'2',name:'Top Ten',score:'28',rank:3}]};
 h.setFeed({season:2026,updatedAt:new Date(baselineTime).toISOString(),games:[game],polls:[]});await run(h);
 const preferences=alerts.defaultAlertPreferences();preferences.favorites=[{id:'1',name:'Favorite'}];preferences.myTeams={enabled:true,kickoff:true,final:true};preferences.breaking.enabled=true;preferences.breaking.upsets=true;
 const created=await(await h.subscription.POST(request({action:'create',subscription:endpoint,preferences}))).json();
 h.setFeed({season:2026,updatedAt:new Date(Date.now()+10).toISOString(),games:[{...game,status:'post',completed:true,providerStatus:'STATUS_FINAL',teams:[{...game.teams[0],winner:true},game.teams[1]]}],polls:[]});
 assert.equal((await run(h)).status,200);assert.equal(h.sent.length,1);assert.equal(h.sent[0].payload.id,'game:g1:final');
 // Simulate overlapping/repeated checks with the same preceding snapshot.
 h.values.set('fd:v05:baseline',JSON.stringify({season:2026,updatedAt:new Date(baselineTime).toISOString(),games:[game],polls:[]}));await run(h);assert.equal(h.sent.length,1);
 await h.subscription.POST(request({action:'delete',...created}));
 h.values.set('fd:v05:baseline',JSON.stringify({season:2026,updatedAt:new Date(baselineTime).toISOString(),games:[game],polls:[]}));await run(h);assert.equal(h.sent.length,1);
});
test('changing one category preserves activation time and choices in the other',()=>{
 const h=harness();const p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};p.breaking={enabled:true,upsets:true,developments:true,ap:true,coaches:true,cfp:true};
 const initial=h.store.activationTimes(null,p,1000);
 const old={preferences:p,typeSince:initial};const next=structuredClone(p);next.myTeams.enabled=false;
 const times=h.store.activationTimes(old,next,2000);assert.equal(times.ap,1000);assert.equal(times.development,1000);
 next.myTeams.enabled=true;const reenabled=h.store.activationTimes({...old,preferences:{...p,myTeams:{...p.myTeams,enabled:false}}},next,3000);assert.equal(reenabled.kickoff,3000);assert.equal(reenabled.ap,1000);
});

test('test delivery requires subscription capability; only a single-use worker receipt verifies delivery',async()=>{
 const h=harness();await run(h);const p=alerts.defaultAlertPreferences();p.breaking.enabled=true;p.breaking.ap=true;
 const cap=await(await h.subscription.POST(request({action:'create',subscription:endpoint,preferences:p}))).json();
 assert.equal((await h.testDelivery.POST(request({...cap,token:'0'.repeat(64)}))).status,403);
 assert.equal((await h.testDelivery.POST(request(cap))).status,200);
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].payload.test,true);
 assert.equal((await(await h.config.GET()).json()).deliveryVerifiedAt,null);
 const proof={receipt:h.sent[0].payload.receipt};
 assert.equal((await h.receipt.POST(request(proof,'https://evil.test'))).status,403);
 assert.equal((await h.receipt.POST(request(proof))).status,200);
 assert.ok((await(await h.config.GET()).json()).deliveryVerifiedAt);
 assert.equal((await h.receipt.POST(request(proof))).status,410);
 assert.equal((await h.testDelivery.POST(request(cap))).status,429);
});
