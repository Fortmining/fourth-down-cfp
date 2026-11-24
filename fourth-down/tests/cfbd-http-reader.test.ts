import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamReader} from '../app/lib/cfbd-http-reader.ts';
const cfg={enabled:true,clientId:'private-id',clientSecret:'private-secret',bearer:'a'.repeat(64)};
const view={version:1,team:'2633',datasets:{}};
const ok=()=>Response.json(view,{headers:{ETag:'"edition-1"'}});
const hour=3600_000;

test('authenticated fixed-origin fetch, fresh cache, conditional 304 and concurrent collapse',async()=>{
 let clock=0,calls=0;
 const read=createTeamReader({config:()=>cfg,now:()=>clock,request:async(url,opts)=>{
  calls++;assert.equal(url,'https://cfbd.fortmedia.cc/v1/teams/2633');
  assert.equal(opts?.redirect,'error');assert.equal(opts?.cache,'no-store');
  const headers=new Headers(opts?.headers);
  assert.equal(headers.get('user-agent'),'FourthDownPulseReader/1.0');
  assert.equal(headers.get('authorization'),'Bearer '+cfg.bearer);
  assert.equal(headers.get('CF-Access-Client-Secret'),cfg.clientSecret);
  assert.equal(headers.get('CF-Access-Client-Id'),cfg.clientId);
  if(calls===2){assert.equal(headers.get('if-none-match'),'"edition-1"');return new Response(null,{status:304});}
  return ok();
 }});
 assert.deepEqual(await read('2633'),{view,stale:false});
 await read('2633');assert.equal(calls,1);
 clock=6*hour;await Promise.all([read('2633'),read('2633')]);assert.equal(calls,2);
 clock+=hour;assert.equal((await read('2633')).stale,false);assert.equal(calls,2);
 assert.equal((await read('../worker.sqlite')).view,null);assert.equal(calls,2);
});

test('transient outage retains bounded previous edition, backs off, recovers and expires',async()=>{
 let clock=0,calls=0,fail=false;
 const read=createTeamReader({config:()=>cfg,now:()=>clock,request:async()=>{calls++;if(fail)throw Error('secret upstream body');return ok();}});
 await read('2633');fail=true;clock=6*hour;
 assert.deepEqual(await read('2633'),{view,stale:true});await read('2633');assert.equal(calls,2);
 clock+=60_000;fail=false;assert.equal((await read('2633')).stale,false);
 clock+=25*hour;fail=true;assert.equal((await read('2633')).view,null);
});

test('authorization revocation clears previous data; credential rotation and disable clear cache',async()=>{
 let clock=0,status=200,config={...cfg};
 const read=createTeamReader({config:()=>config,now:()=>clock,request:async()=>status===200?ok():new Response(null,{status})});
 await read('2633');clock=6*hour;status=403;assert.equal((await read('2633')).view,null);
 status=500;assert.equal((await read('2633')).view,null);
 status=200;await read('2633');config={...cfg,clientSecret:'rotated'};status=500;
 assert.equal((await read('2633')).view,null);
 config={...cfg,enabled:false};assert.equal((await read('2633')).view,null);
});

test('cold failures reject invalid, oversized, unexpected and cross-team responses',async()=>{
 const responses=[()=>new Response(null,{status:304}),()=>Response.json({...view,team:'61'}),
  ()=>Response.json({...view,raw:[]}),()=>new Response('not json',{headers:{'content-type':'application/json'}}),
  ()=>new Response('x'.repeat(24577),{headers:{'content-type':'application/json'}}),
  ()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'24577'}}),
  ()=>new Response('<html>Access</html>',{headers:{'content-type':'text/html'}}),
  ()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(24500));c.enqueue(new Uint8Array(100));c.close();}}),{headers:{'content-type':'application/json'}})];
 for(const response of responses){const read=createTeamReader({config:()=>cfg,request:async()=>response()});
  assert.deepEqual(await read('2633'),{view:null,stale:false});}
});

test('timeout aborts a hung request without leaking error details',async()=>{
 const read=createTeamReader({config:()=>cfg,request:async(_url,opts)=>new Promise((_resolve,reject)=>{
  opts?.signal?.addEventListener('abort',()=>reject(Error('private credentials')),{once:true});
 })});
 assert.deepEqual(await read('2633'),{view:null,stale:false});
});
