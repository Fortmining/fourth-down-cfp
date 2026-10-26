import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import * as ranking from '../app/lib/rankings.ts';
import {deriveAlertEvents} from '../app/lib/alerts.ts';
const require=createRequire(import.meta.url),{createPatchedFetcher}=require('next/dist/server/lib/patch-fetch.js');
const source=ts.transpileModule(fs.readFileSync('app/lib/live-feed.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const raw=status=>({season:{year:2026},events:[{id:'401856731',name:'Tennessee at South Carolina',date:new Date(Date.now()-4*3600000).toISOString(),status:{type:{state:status,completed:status==='post',name:status==='post'?'STATUS_FINAL':'STATUS_IN_PROGRESS'}},competitions:[{competitors:[{team:{id:'2633',displayName:'Tennessee'},score:'24'},{team:{id:'2579',displayName:'South Carolina'},score:'27',winner:true}]}]}]});
function loader(fetch){const exports={};vm.runInNewContext(source,{exports,fetch,Date,AbortSignal,require:name=>name.includes('current-records')?{loadCurrentRecords:async()=>({currentRecords:{}})}:name.includes('rankings')?ranking:{NextResponse:{json:(body,options)=>({body,status:options?.status||200,headers:options?.headers})}}});return exports.loadLiveFeed;}
function cacheHarness(){
 const entries=new Map(),calls=[],originCalls=[];const scoreboard='https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=150';
 entries.set(scoreboard,{isStale:true,value:{kind:'FETCH',data:{body:Buffer.from(JSON.stringify(raw('in'))).toString('base64'),headers:{'content-type':'application/json'},status:200,url:scoreboard},revalidate:60}});
 const work={route:'/api/alerts/dispatch',forceDynamic:true,isStaticGeneration:false,incrementalCache:{generateCacheKey:async url=>url,lock:async()=>async()=>{},get:async key=>entries.get(key),set:async(key,value)=>entries.set(key,{value,isStale:false})}};
 const patched=createPatchedFetcher(async url=>{originCalls.push(url);return new Response(JSON.stringify(url.includes('scoreboard')?raw('post'):{rankings:[]}),{headers:{'content-type':'application/json',date:new Date().toUTCString(),age:'0',etag:'fixture-final'}});},{workAsyncStorage:{getStore:()=>work},workUnitAsyncStorage:{getStore:()=>undefined}});
 const fetch=async(url,options)=>{calls.push({url,options});return patched(url,options);};return {load:loader(fetch),calls,originCalls,work};
}
test('website preserves cache/SWR behavior while alert snapshots bypass a stale Live cache on the first Final check',async()=>{
 const web=cacheHarness(),visible=await web.load();assert.equal(visible.body.games[0].status,'in');assert.match(visible.headers['Cache-Control'],/s-maxage=60/);assert.equal(visible.body.sourceFetch,undefined);assert.equal(web.calls[0].options.next.revalidate,60);
 const alerts=cacheHarness(),current=await alerts.load({forAlerts:true});assert.equal(current.body.games[0].status,'post');assert.equal(current.body.games[0].completed,true);assert.equal(current.headers['Cache-Control'],'no-store');
 for(const c of alerts.calls){assert.equal(c.options.cache,'no-store');assert.equal(c.options.next,undefined);}assert.equal(current.body.sourceFetch.scoreboard.policy,'no-store');assert.equal(current.body.sourceFetch.scoreboard.ok,true);assert.equal(current.body.sourceFetch.scoreboard.ageSeconds,0);assert.equal(current.body.sourceFetch.scoreboard.etag,'fixture-final');assert.ok(Date.parse(current.body.sourceFetch.scoreboard.bodyParsedAt)<=Date.parse(current.body.updatedAt));
 const now=Date.parse(current.body.updatedAt),previous={...current.body,updatedAt:new Date(now-240000).toISOString(),games:current.body.games.map(g=>({...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',completed:false}))};
 assert.deepEqual(deriveAlertEvents(previous,current.body,[],now).map(e=>e.id),['game:401856731:final']);assert.equal(deriveAlertEvents(current.body,{...current.body,updatedAt:new Date(now+240000).toISOString()},[],now+240000).length,0);
 await Promise.allSettled(Object.values(web.work.pendingRevalidates||{}));
});
test('a failed fresh scoreboard never falls back to stale cached Live/Final data and does not claim origin freshness',async()=>{
 const current=await loader(async url=>{if(url.includes('scoreboard'))throw Error('fixture outage');return {ok:true,json:async()=>({rankings:[]})};})({forAlerts:true});assert.equal(current.status,200);assert.equal(current.body.scoreboardAvailable,false);assert.equal(current.body.games.length,0);assert.equal(current.body.sourceFetch.scoreboard.ok,false);assert.equal(current.body.sourceFetch.scoreboard.bodyParsedAt,undefined);
});
test('missed checks preserve the existing final transition gap guard instead of inventing historical final alerts',async()=>{
 const current=await cacheHarness().load({forAlerts:true}),now=Date.parse(current.body.updatedAt),previous={...current.body,games:current.body.games.map(g=>({...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',completed:false}))};
 assert.equal(deriveAlertEvents({...previous,updatedAt:new Date(now-299000).toISOString()},current.body,[],now).length,1);
 assert.equal(deriveAlertEvents({...previous,updatedAt:new Date(now-480000).toISOString()},current.body,[],now).length,0);
});

test('alert checks refresh current official rankings but retain caching for historical rankings and future schedules',async()=>{
 const calls=[],now=Date.now(),scores=raw('post');scores.leagues=[{calendar:[{value:'2',entries:[{value:'9',startDate:new Date(now+86400000).toISOString()},{value:'10',startDate:new Date(now+8*86400000).toISOString()}]}]}];
 const load=loader(async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('rankings')?{rankings:[],latestWeek:{number:8}}:url.includes('week=')?{events:[]}:scores};});await load({forAlerts:true});
 assert.equal(calls.length,5);for(const c of calls){if(c.url.endsWith('/rankings')||c.url.endsWith('scoreboard?groups=80&limit=150'))assert.equal(c.options.cache,'no-store');else{assert.equal(c.options.next.revalidate,60);assert.equal(c.options.cache,undefined);}}
});
test('public live route cannot opt visitors into the internal fresh-alert mode through query parameters',async()=>{
 const exports={},calls=[];vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/live/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({loadLiveFeed:async options=>{calls.push(options);return 'cached';}})});assert.equal(await exports.GET(new Request('https://test/api/live?forAlerts=true')),'cached');assert.equal(calls[0],undefined);
});
