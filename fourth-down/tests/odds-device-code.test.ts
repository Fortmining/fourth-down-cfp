import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeDeviceApproval,issueDeviceApproval,enrollDevice} from '../app/lib/odds-device-auth.ts';
test('manual approval can be pasted from chat without altering existing link approvals',()=>{
 assert.equal(normalizeDeviceApproval(' abcd-1234-ef56 '),'ABCD1234EF56');
 const legacy='x'.repeat(20)+'-'+'y'.repeat(22);assert.equal(normalizeDeviceApproval(legacy),legacy);
});
test('manual codes are random, expiring, and collision-safe without revealing server credentials',async()=>{
 const before=globalThis.fetch,env={...process.env};const commands:unknown[][]=[];
 process.env.ODDS_PILOT_REDIS_URL='https://test.upstash.io';process.env.ODDS_PILOT_REDIS_TOKEN='synthetic';
 globalThis.fetch=async(_url,init)=>{commands.push(JSON.parse(String(init?.body)));return Response.json({result:'OK'});};
 try{const a=await issueDeviceApproval(0,true),b=await issueDeviceApproval(0,true);assert.match(a,/^[A-F0-9]{12}$/);assert.notEqual(a,b);assert.ok(!String(commands[0][1]).includes(a));assert.deepEqual(commands[0].slice(2),['0','NX','EX',86400]);globalThis.fetch=async()=>Response.json({result:null});await assert.rejects(()=>issueDeviceApproval(0,true),/unique/);}finally{globalThis.fetch=before;process.env=env;}
});
test('manual code attempt limit fails before approval lookup or registration',async()=>{
 const before=globalThis.fetch,env={...process.env};let calls=0;
 process.env.ODDS_PILOT_REDIS_URL='https://test.upstash.io';process.env.ODDS_PILOT_REDIS_TOKEN='synthetic';
 globalThis.fetch=async()=>{calls++;return Response.json({result:0});};
 try{await assert.rejects(()=>enrollDevice('abcd-1234-ef56'),/limited/);assert.equal(calls,1);}finally{globalThis.fetch=before;process.env=env;}
});

test('Friday-night UTC rollover does not spend the Saturday morning refresh early',async()=>{
 const {oddsRefreshDue}=await import('../app/lib/private-odds-cache.ts');
 const observed='2026-11-27T19:30:00Z';
 assert.equal(oddsRefreshDue('2026-11-28',observed,Date.parse('2026-11-28T01:31:00Z')),false);
 assert.equal(oddsRefreshDue('2026-11-28',observed,Date.parse('2026-11-28T13:59:00Z')),false);
 assert.equal(oddsRefreshDue('2026-11-28',observed,Date.parse('2026-11-28T14:00:00Z')),true);
});
