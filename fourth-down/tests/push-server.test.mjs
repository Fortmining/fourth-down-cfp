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
 let sendError=null,auditError=false;const news=[];
 const values=new Map(),hashes=new Map(),lists=new Map();const sent=[];
 let feed={season:2026,updatedAt:new Date().toISOString(),games:[],polls:[]};
 const json=(body,init)=>new Response(JSON.stringify(body),{status:init?.status||200,headers:init?.headers});
 function command(args){
  const [raw,key,...rest]=args,op=raw.toUpperCase();
  if(op==='LPUSH'){if(auditError)throw Error('Isolated audit failure');const list=lists.get(key)||[];list.unshift(rest[0]);lists.set(key,list);return list.length;}
  if(op==='LTRIM'){lists.set(key,(lists.get(key)||[]).slice(Number(rest[0]),Number(rest[1])+1));return 'OK';}
  if(op==='LRANGE')return (lists.get(key)||[]).slice(Number(rest[0]),Number(rest[1])+1);
  if(op==='GET')return values.get(key)??null;
  if(op==='GETDEL'){const v=values.get(key)??null;values.delete(key);return v;}
  if(op==='SET'){if(rest.includes('NX')&&values.has(key))return null;values.set(key,rest[0]);return 'OK';}
  if(op==='INCR'){const next=Number(values.get(key)||0)+1;values.set(key,next);return next;}
  if(op==='EXPIRE')return 1;
  if(op==='EVAL'){
   if(args[1].includes("redis.call('hget'")){const h=hashes.get(args[3]);if(h?.get(args[4])!==args[5])return 0;h.set(args[4],args[6]);return 1;}
   values.delete(args[3]);return 1;
  }
  if(op==='HGET')return hashes.get(key)?.get(rest[0])??null;
  if(op==='HSET'||op==='HSETNX'){if(!hashes.has(key))hashes.set(key,new Map());const h=hashes.get(key);if(op==='HSETNX'&&h.has(rest[0]))return 0;h.set(rest[0],rest[1]);return 1;}
  if(op==='HDEL')return Number(hashes.get(key)?.delete(rest[0])||0);
  if(op==='HGETALL')return [...(hashes.get(key)||new Map()).entries()].flat();
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
 const dispatcher=load('app/api/alerts/dispatch/route.ts',{'../../live/route':{GET:async()=>json(feed)},'../../../data/confirmed-developments.json':news, 'web-push':{setVapidDetails(){},async sendNotification(s,payload){sent.push({s,payload:JSON.parse(payload)});if(sendError)throw sendError;}}});
 const sender={'web-push':{setVapidDetails(){},async sendNotification(s,payload){sent.push({s,payload:JSON.parse(payload)});if(sendError)throw sendError;}}};
 const testDelivery=load('app/api/alerts/test/route.ts',sender);
 const receipt=load('app/api/alerts/receipt/route.ts');
 const verification=load('app/api/alerts/verification/route.ts');
 return {verification,news,setAuditError(value){auditError=value;},setSendError(error){sendError=error;},testDelivery,receipt,store,subscription,config,dispatcher,values,hashes,lists,sent,setFeed(next){feed=next;},command};
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

async function subscribe(h,preferences,suffix='test') {
 return (await h.subscription.POST(request({action:'create',subscription:{...endpoint,endpoint:endpoint.endpoint+suffix},preferences}))).json();
}
const snapshot=(games=[],polls=[],offset=-1000)=>({season:2026,updatedAt:new Date(Date.now()+offset).toISOString(),games,polls});
const match=(status='pre')=>({id:'routing-game',name:'One at Two',date:new Date(Date.now()-60000).toISOString(),status,providerStatus:status==='post'?'STATUS_FINAL':status==='in'?'STATUS_IN_PROGRESS':'STATUS_SCHEDULED',completed:status==='post',teams:[{id:'1',name:'One',score:'31',winner:status==='post'},{id:'2',name:'Two',score:'28',rank:3}]});
test('scheduled background test waits, delivers once, and records a distinct receipt only after browser acknowledgement',async()=>{
 const h=harness();await run(h);const p=alerts.defaultAlertPreferences();p.breaking.enabled=true;p.breaking.ap=true;const cap=await subscribe(h,p);
 assert.equal((await h.testDelivery.POST(request({...cap,mode:'background'}))).status,200);
 assert.equal((await run(h)).status,200);assert.equal(h.sent.length,0,'not sent while user is closing the app');
 const queued=h.hashes.get('fd:v05:background-tests');const job=JSON.parse(queued.get(cap.id));job.dueAt=Date.now()-1;queued.set(cap.id,JSON.stringify(job));
 assert.equal((await run(h)).status,200);assert.equal(h.sent.length,1);assert.equal(h.sent[0].payload.test,true);assert.match(h.sent[0].payload.title,/Background test/);
 await run(h);assert.equal(h.sent.length,1);
 assert.equal((await(await h.config.GET()).json()).backgroundVerifiedAt,null);
 assert.equal((await h.receipt.POST(request({receipt:h.sent[0].payload.receipt}))).status,200);
 assert.ok((await(await h.config.GET()).json()).backgroundVerifiedAt);
});
test('scheduled tests expire and respect unsubscribe or all categories muted before dispatch',async()=>{
 for(const condition of ['expired','unsubscribed','muted']){
  const h=harness();await run(h);const p=alerts.defaultAlertPreferences();p.breaking.enabled=true;p.breaking.ap=true;const cap=await subscribe(h,p);
  await h.testDelivery.POST(request({...cap,mode:'background'}));const queued=h.hashes.get('fd:v05:background-tests');const job=JSON.parse(queued.get(cap.id));job.dueAt=Date.now()-1;if(condition==='expired')job.expiresAt=Date.now()-1;queued.set(cap.id,JSON.stringify(job));
  if(condition==='unsubscribed')await h.subscription.POST(request({action:'delete',...cap}));
  if(condition==='muted')await h.subscription.POST(request({action:'update',...cap,subscription:{...endpoint,endpoint:endpoint.endpoint+'test'},preferences:alerts.defaultAlertPreferences()}));
  await run(h);assert.equal(h.sent.length,0,condition);assert.equal(queued.size,0);
 }
});
test('favorite kickoff routing excludes unrelated favorites and disabled types',async()=>{
 const h=harness();const before=snapshot([match()],[],-60000);h.setFeed(before);await run(h);
 for(const [id,team,kickoff] of [['a','1',true],['b','9',true],['c','1',false]]){const p=alerts.defaultAlertPreferences();p.favorites=[{id:team,name:team}];p.myTeams={enabled:true,kickoff,final:true};await subscribe(h,p,id);}
 h.setFeed(snapshot([match('in')],[],10));await run(h);assert.equal(h.sent.length,1);assert.ok(h.sent[0].s.endpoint.endsWith('a'));assert.deepEqual(h.sent[0].payload.types,['kickoff']);
 h.values.set('fd:v05:baseline',JSON.stringify(before));await run(h);assert.equal(h.sent.length,1);
});
test('AP, Coaches, CFP and reviewed developments route independently and repeated checks dedupe',async()=>{
 const h=harness();const now=Date.now();const poll=(id,week)=>({id,name:id,status:'available',season:2026,week,date:new Date(now-(week===8?86400000:100)).toISOString(),teams:Array.from({length:25},(_,i)=>({rank:i+1,teamId:String(i+1),name:'Team '+i}))});
 const before=snapshot([],['ap','coaches','cfp'].map(id=>poll(id,8)),-60000);h.setFeed(before);await run(h);
 for(const type of ['ap','coaches','cfp','developments']){const p=alerts.defaultAlertPreferences();p.breaking.enabled=true;p.breaking[type]=true;const cap=await subscribe(h,p,type);const record=JSON.parse(h.hashes.get(h.store.SUBS).get(cap.id));record.typeSince.development=now-5000;h.hashes.get(h.store.SUBS).set(cap.id,JSON.stringify(record));}
 h.news.push({id:'test-reviewed-report',title:'TEST ONLY official report',summary:'Isolated fixture, never published.',sourceUrl:'https://collegefootballplayoff.com/news/test',publishedAt:new Date(now-1000).toISOString(),verifiedAt:new Date(now-500).toISOString(),confirmed:true});
 h.setFeed(snapshot([],['ap','coaches','cfp'].map(id=>poll(id,9)),10));await run(h);assert.equal(h.sent.length,4);
 for(const type of ['ap','coaches','cfp'])assert.equal(h.sent.filter(s=>s.payload.types.includes(type)).length,1);
 assert.equal(h.sent.filter(s=>s.payload.types.includes('development')).length,1);
 h.values.set('fd:v05:baseline',JSON.stringify(before));await run(h);assert.equal(h.sent.length,4);
});
test('provider expiration removes endpoints and ambiguous delivery failures never retry the same event',async()=>{
 for(const statusCode of [410,undefined]){
  const h=harness();const before=snapshot([match('in')],[],-60000);h.setFeed(before);await run(h);const p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams.enabled=true;p.myTeams.final=true;const cap=await subscribe(h,p);
  h.setSendError(Object.assign(new Error('provider test failure'),{statusCode}));h.setFeed(snapshot([match('post')],[],10));assert.equal((await run(h)).status,502);assert.equal(h.sent.length,1);
  assert.equal(!!await h.store.loadSubscription(cap.id),statusCode!==410);
  h.values.set('fd:v05:baseline',JSON.stringify(before));await run(h);assert.equal(h.sent.length,1);
 }
});

test('a failed background test does not prevent real event processing or the next baseline',async()=>{
 const h=harness();h.setFeed(snapshot([match('in')],[],-60000));await run(h);const p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams.enabled=true;p.myTeams.final=true;const cap=await subscribe(h,p);
 await h.testDelivery.POST(request({...cap,mode:'background'}));const jobs=h.hashes.get('fd:v05:background-tests');const job=JSON.parse(jobs.get(cap.id));job.dueAt=Date.now()-1;jobs.set(cap.id,JSON.stringify(job));
 h.setSendError(new Error('ambiguous timeout'));h.setFeed(snapshot([match('post')],[],10));const response=await run(h);assert.equal(response.status,502);assert.equal(h.sent.length,2);assert.equal(h.sent[0].payload.test,true);assert.equal(h.sent[1].payload.id,'game:routing-game:final');assert.equal(JSON.parse(h.values.get('fd:v05:baseline')).games[0].status,'post');
});

test('real event receipts verify only selected types; private verification exposes no endpoint or capability',async()=>{
 const h=harness();h.setFeed(snapshot([match('in')],[],-60000));await run(h);const p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams.enabled=true;p.myTeams.final=true;await subscribe(h,p);
 h.setFeed(snapshot([match('post')],[],10));await run(h);assert.deepEqual(h.sent[0].payload.types,['final']);
 assert.equal((await h.verification.GET(new Request('https://fourth-down-cfp.vercel.app/api/alerts/verification'))).status,401);
 const privateRequest=new Request('https://fourth-down-cfp.vercel.app/api/alerts/verification',{headers:{authorization:'Bearer test-secret'}});
 assert.deepEqual((await(await h.verification.GET(privateRequest)).json()).verifiedEventTypes,{});
 await h.receipt.POST(request({receipt:h.sent[0].payload.receipt}));const proof=await(await h.verification.GET(privateRequest)).json();assert.equal(proof.enabledDeviceCounts.final,1);assert.equal(proof.enabledDeviceCounts.kickoff,0);assert.equal(proof.verifiedEventTypes.final.eventId,'game:routing-game:final');assert.equal(proof.verifiedEventTypes.upset,undefined);assert.equal(JSON.stringify(proof).includes(endpoint.endpoint),false);
});

// All following scenarios below use isolated fake feeds/storage/push transport.
test('temporary game + one-game team + favorite + upset overlap delivers a single final before expiry',async()=>{
 const h=harness(),now=Date.now();const game={...match('in'),id:'123'};const before=snapshot([game],[],-60000);h.setFeed(before);await run(h);
 const p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};p.breaking.enabled=true;p.breaking.upsets=true;
 p.following={enabled:true,items:[{kind:'game',id:'123',name:'One at Two',duration:'game',gameId:'123',createdAt:now-1000,expiresAt:now+86400000},{kind:'team',id:'1',name:'One',duration:'game',gameId:'123',createdAt:now-1000,expiresAt:now+86400000}]};
 const cap=await subscribe(h,p);h.setFeed(snapshot([{...match('post'),id:'123'}],[],10));assert.equal((await run(h)).status,200);
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].payload.id,'game:123:final');
 const saved=await h.store.loadSubscription(cap.id);assert.equal(saved.preferences.following.items.length,0);assert.equal(saved.preferences.favorites.length,1);assert.equal(saved.preferences.breaking.upsets,true);
 h.values.set('fd:v05:baseline',JSON.stringify(before));await run(h);assert.equal(h.sent.length,1);
});
test('temporary-only subscription routes kickoff and final, expires one game, never requests favorites',async()=>{
 const h=harness(),now=Date.now();h.setFeed(snapshot([{...match(),id:'123'}],[],-60000));await run(h);
 const p=alerts.defaultAlertPreferences();p.following={enabled:true,items:[{kind:'team',id:'1',name:'One',duration:'game',gameId:'123',createdAt:now-1000,expiresAt:now+86400000}]};const cap=await subscribe(h,p);
 assert.equal(alerts.hasAlerts(p),true);h.setFeed(snapshot([{...match('in'),id:'123'}],[],5));await run(h);assert.equal(h.sent.length,1);assert.deepEqual(h.sent[0].payload.types,['kickoff']);
 h.setFeed(snapshot([{...match('post'),id:'123'}],[],20));await run(h);assert.equal(h.sent.length,2);assert.deepEqual(h.sent[1].payload.types,['final']);
 assert.equal((await h.store.loadSubscription(cap.id)).preferences.following.items.length,0);
});
test('24-hour and 7-day team follows survive a final; expired or disabled follows never send',async()=>{
 for(const duration of ['24h','7d']){
  const h=harness(),now=Date.now();h.setFeed(snapshot([match('in')],[],-60000));await run(h);
  for(const [suffix,enabled,expiresAt] of [['on',true,now+(duration==='24h'?86400000:7*86400000)-1000],['off',false,now+10000],['expired',true,now-1]]){
   const p=alerts.defaultAlertPreferences();p.following={enabled,items:[{kind:'team',id:'1',name:'One',duration,createdAt:now-1000,expiresAt}]};await subscribe(h,p,suffix);
  }
  h.setFeed(snapshot([match('post')],[],10));await run(h);assert.equal(h.sent.length,1);assert.ok(h.sent[0].s.endpoint.endsWith('on'));
  const saved=[...h.hashes.get(h.store.SUBS).values()].map(JSON.parse).find(x=>x.subscription.endpoint.endsWith('on'));assert.equal(saved.preferences.following.items.length,1);
 }
});
test('following opt-in and mutation preserve favorite and poll activation times',()=>{
 const h=harness(),p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};p.breaking.enabled=true;p.breaking.ap=true;
 const old={preferences:structuredClone(p),typeSince:h.store.activationTimes(null,p,1000)};
 p.following={enabled:true,items:[{kind:'team',id:'2',name:'Two',duration:'24h',createdAt:1500,expiresAt:86401500}]};
 const times=h.store.activationTimes(old,p,2000);assert.equal(times.kickoff,1000);assert.equal(times.final,1000);assert.equal(times.ap,1000);
});

test('production audit retains original follow time, provider selection and completed-follow removal',async()=>{
 const h=harness(),now=Date.now();h.setFeed(snapshot([{...match('in'),id:'123'}],[],-60000));await run(h);
 const p=alerts.defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'123',name:'One at Two',duration:'game',gameId:'123',createdAt:now-900000,expiresAt:now+86400000}]};const cap=await subscribe(h,p);
 h.setFeed(snapshot([{...match('post'),id:'123'}],[],10));await run(h);
 const audit=h.lists.get('fd:v06:audit:'+cap.id).map(JSON.parse);assert.ok(audit.find(x=>x.kind==='settings-saved'&&x.following.items[0].createdAt===now-900000));assert.ok(audit.find(x=>x.kind==='provider-accepted'&&x.eventId==='game:123:final'));const end=audit.find(x=>x.kind==='follows-ended');assert.equal(end.previousFollowing.items[0].createdAt,now-900000);assert.equal(end.following.items.length,0);
 const proof={receipt:h.sent[0].payload.receipt,workerVersion:'0.6.1',platform:'ios',openClients:0};assert.equal((await h.receipt.POST(request(proof))).status,200);const display=h.lists.get('fd:v06:audit:'+cap.id).map(JSON.parse).find(x=>x.kind==='browser-displayed');assert.equal(display.platform,'ios');assert.equal(display.openClients,0);assert.equal(display.deviceAlias,cap.id.slice(0,12));
});

test('an audit outage does not mute a final and cannot erase its original follow timestamp',async()=>{
 const h=harness(),now=Date.now();h.setFeed(snapshot([{...match('in'),id:'123'}],[],-60000));await run(h);const p=alerts.defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'123',name:'One at Two',duration:'game',gameId:'123',createdAt:now-900000,expiresAt:now+86400000}]};const cap=await subscribe(h,p);
 h.setAuditError(true);h.setFeed(snapshot([{...match('post'),id:'123'}],[],10));assert.equal((await run(h)).status,200);assert.equal(h.sent.length,1);assert.equal((await h.store.loadSubscription(cap.id)).preferences.following.items[0].createdAt,now-900000);
 h.setAuditError(false);h.setFeed(snapshot([{...match('post'),id:'123'}],[],20));await run(h);assert.equal(h.sent.length,1);assert.equal((await h.store.loadSubscription(cap.id)).preferences.following.items.length,0);assert.ok(h.lists.get('fd:v06:audit:'+cap.id).map(JSON.parse).find(x=>x.kind==='follow-cleanup-snapshot'));
});
