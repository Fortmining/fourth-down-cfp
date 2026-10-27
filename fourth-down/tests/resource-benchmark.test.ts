import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {runResourceBenchmark,validateBenchmarkBudget,resourceLimits,type BenchmarkRedis} from '../app/lib/playoff/resource-benchmark.ts';
import {boundedStoreScript} from '../app/lib/playoff/bounded-store-script.ts';
import {POST} from '../app/api/private/resume-benchmark/route.ts';
import {replaySnapshotPair} from '../app/lib/playoff/storage-plan.ts';
const budget=()=>({observedAt:new Date().toISOString(),commandsUsed:60000,commandLimit:500000,storageUsedBytes:28_000_000,storageLimitBytes:250_000_000,bandwidthUsedBytes:806_000_000,bandwidthLimitBytes:10_000_000_000});
test('resource benchmark stays disabled without a separately approved Preview gate',async()=>{
 const oldEnv=process.env.VERCEL_ENV,oldFlag=process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK;try{for(const [env,flag] of [['production','true'],['preview',''],['development','true']]){process.env.VERCEL_ENV=env;process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK=flag;assert.equal((await POST(new Request('https://example.test',{method:'POST'}))).status,404);}}finally{if(oldEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldEnv;if(oldFlag===undefined)delete process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK;else process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK=oldFlag;}
});
test('stale, incorrect-plan and over-budget receipts are rejected before storage access',async()=>{
 for(const receipt of [{...budget(),observedAt:'2025-01-01T00:00:00Z'},{...budget(),commandsUsed:399999},{...budget(),commandLimit:1000000},{...budget(),storageUsedBytes:195_000_000},{...budget(),commandsUsed:undefined},{...budget(),bandwidthUsedBytes:'unknown'}]){let calls=0;await assert.rejects(runResourceBenchmark(async()=>{calls++;return null;},receipt as never,'test'));assert.equal(calls,0);}
 validateBenchmarkBudget(budget());assert.equal(resourceLimits.commandReserve,10000);
});
test('embedded retention candidate exactly matches the reviewed Lua source',()=>assert.equal(boundedStoreScript,fs.readFileSync(new URL('../scripts/bounded-shadow-store.lua',import.meta.url),'utf8')));
test('simulated transport verifies bounded isolation, retry recovery, retention, expiry and cache-read load',async()=>{
 const values=new Map<string,string>(),receipts:string[]=[];let first=true;const seen:string[][]=[];
 const fake:BenchmarkRedis=async(...command)=>{const c=command.map(String);seen.push(c);if(c[0]==='SET'){if(c.includes('NX')&&values.has(c[1]))return null;values.set(c[1],c[2]);return 'OK';}
  if(c[0]==='EVAL'){assert.ok(c.slice(3,8).every(k=>/^fd:\{resume-benchmark-[a-f0-9]{24}\}:/.test(k)));const head=values.get(c[3]),old=head?JSON.parse(head):{id:''};if(old.id!==c[8])return [['stale',old.id],1,0];values.set(c[3],JSON.stringify({id:c[10],semantic:c[9]}));receipts.push(c[10]);if(receipts.length>8)receipts.shift();values.set(c[6],String(receipts.length*(c[11].length+512)));if(first){first=false;throw Error('Simulated lost transport response after commit');}return [['stored',c[10]],4,receipts.length===8?11:8];}
  if(c[0]==='EXPIRE')return 1;if(c[0]==='GET')return values.get(c[1])??null;if(c[0]==='HLEN')return receipts.length;if(c[0]==='MEMORY')return 1000;if(c[0]==='TTL')return 3000;throw Error('Unexpected command');
 };
 const r=await runResourceBenchmark(fake,budget(),'isolated-unit-deployment');assert.equal(r.status,'completed');if(r.status!=='completed')return;
 assert.equal(r.snapshotUpdates,12);assert.equal(replaySnapshotPair(seen.find(c=>c[0]==='EVAL')![11]).confirmed.inputs.season,2026);assert.equal(new Set(seen.filter(c=>c[0]==='EVAL').map(c=>c[11])).size,12);assert.equal(r.retainedPairs,8);assert.equal(r.controlledResponseLossRetries,3);assert.equal(r.realTransportRetries,1);assert.equal(r.exactReceiptsRecovered,4);assert.equal(r.visitorCacheReads,400);assert.ok(r.reservedCommandCost<10000);assert.ok(r.mutationBudgetReserved<=400);assert.equal(r.cachedReadAttempts,400);assert.equal(r.productionActivationPermitted,false);assert.equal(r.expiry.verified,true);assert.ok(seen.every(c=>!c.some(x=>/^fd:v0/.test(x))));
 assert.equal((await runResourceBenchmark(fake,budget(),'isolated-unit-deployment')).status,'already-run');
});

test('a failed expiry check never returns a successful resource measurement',async()=>{
 const failing:BenchmarkRedis=async(...cmd)=>{if(cmd[0]==='SET')return 'OK';if(cmd[0]==='TTL')return -2;throw Error('Simulated unavailable storage');};
 await assert.rejects(runResourceBenchmark(failing,budget(),'failed-expiry-test'),/expiry not verified/);
});

test('enabled Preview benchmark rejects cross-origin requests before storage setup',async()=>{
 const env=process.env.VERCEL_ENV,flag=process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK;try{process.env.VERCEL_ENV='preview';process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK='true';const r=await POST(new Request('https://preview.test/api/private/resume-benchmark',{method:'POST',headers:{Origin:'https://unrelated.test'},body:'{}'}));assert.equal(r.status,403);}finally{if(env===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=env;if(flag===undefined)delete process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK;else process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK=flag;}
});

test('worst-case dispatch including ambiguous attempts and cleanup stays below 400 mutations',()=>{
 // Each of 12 updates can dispatch twice after failure plus three controlled reissues.
 // Lua has at most 8 base mutations + 3 eviction commands; setup/display and cleanup add 8.
 const maximum=(resourceLimits.snapshotUpdates*2+3)*11+8;
 assert.equal(maximum,305);assert.ok(maximum<=resourceLimits.mutationLimit);
 const source=fs.readFileSync(new URL('../app/lib/playoff/resource-benchmark.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/setTimeout|setInterval|waitUntil|\.pipeline\(/);
 assert.match(source,/Promise\.allSettled/);assert.match(source,/mutationReserved\+mutations>resourceLimits\.mutationLimit/);
 assert.doesNotMatch(source,/process\.env\.(?:KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN)/);
});
test('ambiguous partial script operations reserve their full mutation cost and await cleanup',async()=>{
 let mutations=0,active=0;const fake:BenchmarkRedis=async(...c)=>{active++;try{await Promise.resolve();if(c[0]==='SET'){mutations++;return 'OK';}if(c[0]==='EVAL'){mutations+=11;throw Error('Partial operation and lost response');}if(c[0]==='EXPIRE'){mutations++;return 1;}if(c[0]==='TTL')return 3000;throw Error('Unexpected command');}finally{active--;}};
 await assert.rejects(runResourceBenchmark(fake,budget(),'partial-failure'));
 assert.equal(mutations,29);assert.equal(active,0);assert.ok(mutations<=400);
});
