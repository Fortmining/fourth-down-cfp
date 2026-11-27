import assert from 'node:assert/strict';
import test from 'node:test';
import {retainedSnapshot,mergeOddsSnapshots,privateOddsSnapshot} from '../app/lib/private-odds-cache.ts';
import {matchOddsEvent,easternGameDate} from '../app/lib/odds-matching.ts';
import {authorizedDevice,enrollDevice,oddsAdmin} from '../app/lib/odds-device-auth.ts';
import type {OddsSnapshot} from '../app/lib/odds-provider';
const now=Date.now(),kickoff=new Date(now-3600000).toISOString(),captured=new Date(now-3*3600000).toISOString();
function snapshot(at=captured):OddsSnapshot{return {provider:'fixture',observedAt:at,delaySeconds:300,datapoints:20,remaining:19000,quotes:[{eventId:'a',eventName:'Fixture',startsAt:kickoff,market:'moneyline',participant:'Home',participantId:'1',line:null,book:'DraftKings',american:'-110',updatedAt:at}],events:[{id:'a',name:'Fixture',startsAt:kickoff,status:'STATUS_SCHEDULED',teams:[{id:'h',name:'Home',side:'home'},{id:'a',name:'Away',side:'away'}],marketIds:[1],bookIds:['19'],rawPriceRows:1,acceptedPriceRows:1}]};}
test('real pregame capture remains visible live/final; expired and post-kickoff captures are excluded',()=>{
 const s=snapshot();assert.equal(retainedSnapshot(s,now).quotes.length,1);
 assert.equal(retainedSnapshot(snapshot(new Date(now-86400000).toISOString()),now).quotes.length,0);
 assert.equal(retainedSnapshot(snapshot(new Date(now-1000).toISOString()),now).quotes.length,0);
 const game={id:'123',date:kickoff,status:'post',teams:[{id:'h',name:'Home',homeAway:'home'},{id:'a',name:'Away',homeAway:'away'}]};
 assert.equal(matchOddsEvent(game,s.events!,now,true).status,'matched');
 assert.equal(matchOddsEvent({...game,teams:[game.teams[0],{...game.teams[1],name:'Other'}]},s.events!,now,true).event,null);
});
test('refresh keeps live pregame evidence without extending its capture time',()=>{
 const old=snapshot(),next={...snapshot(new Date(now).toISOString()),quotes:[],events:[]};
 const merged=mergeOddsSnapshots(old,next);assert.equal(merged.quotes.length,1);assert.equal(merged.quotes[0].capturedAt,captured);
 assert.equal(retainedSnapshot(merged,Date.parse(captured)+86400000).quotes.length,0);
});
test('Eastern date lookup covers Saturday evening after UTC midnight',()=>{assert.equal(easternGameDate('2026-11-29T02:00:00Z'),'2026-11-28');});
test('anonymous and malformed device access denies without Redis; admin requires full server credential',async()=>{
 const before=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Redis must not be called');};
 try{assert.equal(await authorizedDevice(undefined),false);assert.equal(await authorizedDevice('0.guess'),false);await assert.rejects(()=>enrollDevice('guess'),/invalid/);assert.equal(oddsAdmin(new Request('https://example.test')),false);}finally{globalThis.fetch=before;}
});
test('expired and revoked remembered devices deny, authorized records survive beyond one hour',async()=>{
 const before=globalThis.fetch,env={...process.env},value='0.'+'x'.repeat(43);const {createHash}=await import('node:crypto');const hash=createHash('sha256').update(value).digest('hex');
 process.env.ODDS_PILOT_REDIS_URL='https://test.upstash.io';process.env.ODDS_PILOT_REDIS_TOKEN='fixture';
 try{for(const [record,expected] of [[[{hash,expires:now+86400000}],true],[[{hash,expires:now-1}],false],[[],false]] as const){globalThis.fetch=async()=>Response.json({result:JSON.stringify(record)});assert.equal(await authorizedDevice(value),expected);}}finally{globalThis.fetch=before;process.env=env;}
});
test('cache miss reserves once; simultaneous reads cannot fan out provider calls',async()=>{
 const before=globalThis.fetch,env={...process.env};let grants=0,calls=0;process.env.ODDS_PILOT_REDIS_URL='https://test.upstash.io';process.env.ODDS_PILOT_REDIS_TOKEN='fixture';
 globalThis.fetch=async(_url,init)=>{const command=JSON.parse(String(init?.body));return Response.json({result:command[0]==='GET'?null:++grants===1?1:0});};
 const provider={id:'fixture',fetchPregame:async()=>{calls++;return {...snapshot(),observedAt:new Date().toISOString(),quotes:[]};}};
 try{const results=await Promise.allSettled([privateOddsSnapshot('2026-11-28',provider),privateOddsSnapshot('2026-11-28',provider)]);assert.equal(calls,1);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);}finally{globalThis.fetch=before;process.env=env;}
});
