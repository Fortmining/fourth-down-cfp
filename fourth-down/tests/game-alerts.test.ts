import {test} from 'node:test';import assert from 'node:assert/strict';
import {deriveGameAlerts,extraGameEligible,gameAccessTimes,gameAlertRate} from '../app/lib/game-alerts.ts';
import {defaultAlertPreferences,normalizePreferences,selectedEvent,type AlertFeed,type AlertGame} from '../app/lib/alerts.ts';
import type {Poll} from '../app/lib/rankings.ts';
const now=Date.now(),date=new Date(now-2*3600000).toISOString();
const game=(extra:Partial<AlertGame>={}):AlertGame=>({id:'123',date,name:'One at Two',status:'in',providerStatus:'STATUS_IN_PROGRESS',period:4,clock:300,teams:[{id:'1',name:'One',score:'24'},{id:'2',name:'Two',score:'31'}],...extra});
const poll:Poll={id:'ap',name:'AP Top 25',status:'available',season:2026,week:9,date:new Date(now-86400000).toISOString(),url:'https://apnews.com',message:'Published',teams:Array.from({length:25},(_,i)=>({teamId:String(i+2),name:`Ranked ${i+1}`,rank:i+1,previous:i+1,record:'6-0',conference:'FBS'}))};
const feed=(g:AlertGame,at=now,polls=[poll]):AlertFeed=>({season:2026,updatedAt:new Date(at).toISOString(),games:[g],polls,scoreboardAvailable:true});
function pre(polls=[poll]){return deriveGameAlerts(null,feed(game({status:'pre',providerStatus:'STATUS_SCHEDULED',period:0,clock:0}),now-3600000,polls),null,now-3600000).state;}
test('all new types migrate off while existing following kickoff/final and permanent preferences survive',()=>{
 const p=defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};p.breaking.ap=true;delete p.gameAlerts;const n=normalizePreferences(p);
 assert.deepEqual(n.favorites,p.favorites);assert.deepEqual(n.myTeams,p.myTeams);assert.deepEqual(n.breaking,p.breaking);assert.ok(Object.values(n.gameAlerts!.favorites).every(v=>!v));assert.equal(n.gameAlerts!.following.kickoff,true);assert.equal(n.gameAlerts!.following.final,true);assert.equal(n.gameAlerts!.following.scoring,false);
});
test('late thresholds are inclusive, require verified clock, and coalesce close + AP Upset Watch',()=>{
 const r=deriveGameAlerts(null,feed(game()),pre(),now);assert.equal(r.events.length,1);assert.deepEqual(r.events[0].types,['close','upsetWatch']);assert.equal(r.events[0].id,'game:123:late:fourth');assert.match(r.events[0].body,/AP No. 1/);
 for(const extra of [{clock:301},{period:3},{clock:undefined},{clock:NaN},{providerStatus:'STATUS_DELAYED'},{date:'invalid'},{date:new Date(now+60000).toISOString()},{teams:[{id:'1',name:'One',score:'22'},{id:'2',name:'Two',score:'31'}]}])assert.equal(deriveGameAlerts(null,feed(game(extra)),pre(),now).events.length,0,JSON.stringify(extra));
 const ot=deriveGameAlerts(null,feed(game({period:5,clock:0,teams:[{id:'1',name:'One',score:'7'},{id:'2',name:'Two',score:'21'}]})),pre(),now);assert.deepEqual(ot.events[0].types,['close']);assert.equal(ot.events[0].id,'game:123:late:overtime');
});
test('halftime requires the explicit state and scores; repeated observations retain identity and expire',()=>{
 const live=deriveGameAlerts(null,feed(game({period:2,clock:20}),now-240000),pre(),now-240000);
 const half=game({period:2,clock:0,providerStatus:'STATUS_HALFTIME'}),r=deriveGameAlerts(null,feed(half),live.state,now);assert.deepEqual(r.events.map(e=>e.types),[['halftime']]);
 const repeated=deriveGameAlerts(null,feed(half,now+240000),r.state,now+240000);assert.equal(repeated.events[0].id,r.events[0].id);assert.equal(repeated.events[0].observedAt,now);
 assert.equal(deriveGameAlerts(null,feed(half,now+300000),repeated.state,now+300000).events.length,0);
 assert.equal(deriveGameAlerts(null,feed({...half,teams:[{id:'1',name:'One'},{id:'2',name:'Two'}]}),live.state,now).events.length,0);
});
test('AP edition freezes before live; missing, stale, future or Coaches-only polls do not create upset assertions',()=>{
 const original=pre();const shifted={...poll,date:new Date(now-1000).toISOString(),teams:poll.teams.map((t,i)=>({...t,teamId:i===0?'1':String(i+2)}))};
 const frozen=deriveGameAlerts(null,feed(game(),now,[shifted]),original,now);assert.match(frozen.events[0].body,new RegExp(poll.date!.slice(0,10)));
 for(const polls of [[],[{...poll,id:'coaches'}],[{...poll,date:new Date(now+60000).toISOString()}],[{...poll,date:new Date(now-10*86400000).toISOString()}]] as Poll[][]){const r=deriveGameAlerts(null,feed(game({period:4}),now,polls),pre(polls),now);assert.ok(r.events.every(e=>!e.types.includes('upsetWatch')));}
});
test('only an explicit final and verified underdog winner produce Confirmed Upset, sharing the final identity',()=>{
 const final=game({status:'post',providerStatus:'STATUS_FINAL',completed:true,period:4,clock:0,teams:[{id:'1',name:'One',score:'34',winner:true},{id:'2',name:'Two',score:'31',winner:false}]});
 const r=deriveGameAlerts(null,feed(final),pre(),now);assert.equal(r.events[0].id,'game:123:final');assert.deepEqual(r.events[0].types,['confirmedUpset']);
 for(const extra of [{completed:false},{providerStatus:'STATUS_CANCELED'},{teams:[{id:'1',name:'One',score:'34'},{id:'2',name:'Two',score:'31'}]}])assert.equal(deriveGameAlerts(null,feed({...final,...extra}),pre(),now).events.length,0);
 assert.equal(deriveGameAlerts(null,feed(game(),now+1000),r.state,now+1000).events.length,0,'terminal state cannot reopen on bad live feed');
});
test('scoring requires an observed increase, suppresses corrections and first-load backlog, and uses score identities',()=>{
 const initial=deriveGameAlerts(null,feed(game({period:1,clock:500}),now-1000),null,now-1000);
 const scored=game({period:1,clock:480,teams:[{id:'1',name:'One',score:'31'},{id:'2',name:'Two',score:'31'}]});const r=deriveGameAlerts(null,feed(scored),initial.state,now);assert.deepEqual(r.events[0].types,['scoring']);assert.match(r.events[0].id,/score:1-31:2-31$/);assert.equal(gameAlertRate(r.events[0]),600000);
 const correction=deriveGameAlerts(null,feed(game({period:1,clock:470}),now+1000),r.state,now+1000);assert.equal(correction.events.length,0);
 assert.equal(deriveGameAlerts(null,feed(scored,now+2000),correction.state,now+2000).events.length,0);assert.equal(initial.events.length,0);
});
test('scope opt-ins are independent and adding a new scope cannot backfill earlier tactical alerts',()=>{
 const p=defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams.enabled=true;p.gameAlerts!.favorites.halftime=true;
 const e={id:'game:123:halftime',types:['halftime'] as ['halftime'],teamIds:['1','2'],observedAt:now,expiresAt:now+300000,title:'Halftime',body:'Scores',url:'/game/123'};
 const saved={id:'device',preferences:p,updatedAt:now-1000,gameAccess:gameAccessTimes(null,p,now-1000)} as Parameters<typeof extraGameEligible>[1];assert.equal(extraGameEligible(e,saved,'halftime',now),true);assert.equal(selectedEvent(e,p),true);
 p.myTeams.enabled=false;assert.equal(extraGameEligible(e,saved,'halftime',now),false);p.following={enabled:true,items:[{kind:'game',id:'123',gameId:'123',duration:'game',name:'One',createdAt:now-3600000,expiresAt:now+86400000}]};assert.equal(selectedEvent(e,p),false);
 const beforeEnable=structuredClone(saved);p.gameAlerts!.following.halftime=true;const next=gameAccessTimes(beforeEnable,p,now+1);assert.equal(next['following:halftime'],now+1);
});
test('stale or unavailable feeds cannot create optional game alerts or move state backwards',()=>{
 for(const f of [{...feed(game()),scoreboardAvailable:false},{...feed(game()),updatedAt:new Date(now-90001).toISOString()},{...feed(game()),updatedAt:new Date(now+30001).toISOString()}])assert.equal(deriveGameAlerts(null,f,pre(),now).events.length,0);
});
test('cold-start halftime does not become a historical alert on the next unchanged poll',()=>{
 const half=game({period:2,clock:0,providerStatus:'STATUS_HALFTIME'}),first=deriveGameAlerts(null,feed(half),null,now);assert.equal(first.events.length,0);assert.equal(deriveGameAlerts(feed(half),feed(half,now+240000),first.state,now+240000).events.length,0);
});
