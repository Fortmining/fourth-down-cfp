import {test} from 'node:test';import assert from 'node:assert/strict';
import {GET} from '../app/api/private/resume-benchmark/route.ts';
test('benchmark is unavailable in production and ordinary development',async()=>{
 const old=process.env.VERCEL_ENV;try{for(const env of ['production','development','']){process.env.VERCEL_ENV=env;const r=await GET();assert.equal(r.status,404);assert.equal(r.headers.get('Cache-Control'),'no-store');}}finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
test('simulated preview benchmark is bounded and measures real fixture CPU without external operations',async()=>{
 const old=process.env.VERCEL_ENV;try{process.env.VERCEL_ENV='preview';const r=await GET(),d=await r.json();assert.equal(r.status,200);assert.equal(d.teams,138);assert.equal(d.games,888);assert.equal(d.runs.length,10);assert.ok(d.medianCpuMs>0);assert.ok(d.maxCompressedViewBytes>0);assert.equal(d.additionalSourceRequests,0);assert.equal(d.databaseCommands,0);assert.equal(d.notificationCalls,0);assert.equal(d.hostedRedisWriteBillingMeasured,false);}finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
