import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {IDBFactory} from 'fake-indexeddb';
import {defaultAlertPreferences} from '../app/lib/alerts.ts';
function worker(indexedDB=new IDBFactory(),failDisplay=false) {
 const listeners={};const shown=[];const receipts=[];
 vm.runInNewContext(fs.readFileSync('public/alerts-sw.js','utf8'),{indexedDB,URL,Date,console,fetch:async(url,options)=>{receipts.push({url,body:JSON.parse(options.body)});return {ok:true};},self:{addEventListener:(type,handler)=>listeners[type]=handler,location:{origin:'https://fourth-down-cfp.vercel.app'},skipWaiting(){},clients:{claim(){},matchAll:async()=>[]},registration:{showNotification:async(title,options)=>{if(failDisplay)throw Error('Display failed');shown.push({title,options});}}}});
 async function prefs(preferences) {let pending;listeners.message({data:{type:'alert-preferences',preferences},ports:[{postMessage(){}}],waitUntil(p){pending=p;}});await pending;}
 async function push(message) {let pending;listeners.push({data:{json:()=>message},waitUntil(p){pending=p;}});await pending;}
 return {shown,receipts,prefs,push};
}
const message={id:'game:1:final',types:['final','upset'],teamIds:['1','2'],title:'Final score',body:'Team One 31 · Team Two 28',url:'/#scores'};
test('worker fails closed before opt-in and coalesces simultaneous duplicate pushes durably',async()=>{
 const w=worker();await w.push(message);assert.equal(w.shown.length,0);
 const p=defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};p.breaking.enabled=true;p.breaking.upsets=true;
 await w.prefs(p);await Promise.all([w.push(message),w.push(message)]);assert.equal(w.shown.length,1);
 await w.push(message);assert.equal(w.shown.length,1);
 assert.equal(w.shown[0].options.tag,message.id);
});
test('local unsubscribe suppresses already queued notifications, independently of server connectivity',async()=>{
 const w=worker();const p=defaultAlertPreferences();p.breaking.enabled=true;p.breaking.upsets=true;await w.prefs(p);
 await w.push(message);assert.equal(w.shown.length,1);
 p.breaking.enabled=false;await w.prefs(p);await w.push({...message,id:'game:2:final'});assert.equal(w.shown.length,1);
});
test('worker keeps My Teams and Breaking CFP News eligibility independent',async()=>{
 const w=worker();const p=defaultAlertPreferences();p.myTeams={enabled:true,kickoff:true,final:true};p.favorites=[{id:'9',name:'Other'}];
 await w.prefs(p);await w.push(message);assert.equal(w.shown.length,0);
 p.breaking.enabled=true;p.breaking.upsets=true;await w.prefs(p);await w.push(message);assert.equal(w.shown.length,1);
});

test('worker restart retains duplicate claims; background receipt follows notification display only',async()=>{
 const db=new IDBFactory();const first=worker(db);const p=defaultAlertPreferences();p.breaking.enabled=true;p.breaking.ap=true;await first.prefs(p);
 const payload={...message,id:'test:background',test:true,types:[],receipt:'a'.repeat(64)};
 await first.push(payload);assert.equal(first.shown.length,1);assert.equal(first.receipts.length,1);
 const restarted=worker(db);await restarted.push(payload);assert.equal(restarted.shown.length,0);assert.equal(restarted.receipts.length,0);
 const failure=worker(new IDBFactory(),true);await failure.prefs(p);await assert.rejects(failure.push({...payload,id:'test:failure'}));assert.equal(failure.receipts.length,0);
});

test('real game alert receipt is sent once after display and respects local category opt-out',async()=>{
 const w=worker();const p=defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams.enabled=true;p.myTeams.final=true;await w.prefs(p);
 const payload={...message,receipt:'c'.repeat(64)};await Promise.all([w.push(payload),w.push(payload)]);assert.equal(w.shown.length,1);assert.equal(w.receipts.length,1);
 p.myTeams.enabled=false;await w.prefs(p);await w.push({...payload,id:'game:2:final'});assert.equal(w.receipts.length,1);
});

test('temporary worker eligibility, overlap dedupe, timed expiry and queued unfollow',async()=>{
 const w=worker(),now=Date.now();const p=defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'1',name:'One at Two',duration:'game',gameId:'1',createdAt:now-1000,expiresAt:now+86400000}]};
 const payload={...message,observedAt:now};await w.prefs(p);await Promise.all([w.push(payload),w.push(payload)]);assert.equal(w.shown.length,1);
 p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};await w.prefs(p);await w.push(payload);assert.equal(w.shown.length,1);
 p.myTeams.enabled=false;p.following.items=[];await w.prefs(p);await w.push({...payload,id:'game:1:kickoff',types:['kickoff']});assert.equal(w.shown.length,1);
 p.following.items=[{kind:'team',id:'1',duration:'24h',createdAt:now-1000,expiresAt:now-1}];await w.prefs(p);await w.push({...payload,id:'game:2:final'});assert.equal(w.shown.length,1);
});

test('worker reports its revision and zero open clients after processing a background real event',async()=>{
 const w=worker(),p=defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams.enabled=true;p.myTeams.final=true;await w.prefs(p);await w.push({...message,receipt:'d'.repeat(64)});assert.equal(w.receipts[0].body.workerVersion,'0.8.0');assert.equal(w.receipts[0].body.openClients,0);assert.equal(w.receipts[0].body.platform,'unknown');
});
test('recovered kickoff enforces expiry and original eligibility time without consuming final dedupe',async()=>{
 const now=Date.now(),w=worker(),p=defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'123',gameId:'123',name:'One',duration:'game',createdAt:now-3600000,expiresAt:now+86400000}]};await w.prefs(p);
 const e={id:'game:123:kickoff',types:['kickoff'],teamIds:['1','2'],title:'Kickoff confirmed',body:'One at Two',url:'/game/123',observedAt:now,eligibilityAt:now-60000,expiresAt:now+60000};
 await Promise.all([w.push(e),w.push(e)]);assert.equal(w.shown.length,1);
 await w.push({...e,id:'game:124:kickoff',expiresAt:now-1});assert.equal(w.shown.length,1);
 p.following.items[0].createdAt=now;await w.prefs(p);await w.push({...e,id:'game:123:kickoff-new'});assert.equal(w.shown.length,1);
 await w.push({...e,id:'game:123:final',types:['final'],eligibilityAt:undefined});assert.equal(w.shown.length,2);
});
test('new optional game types stay muted until each scope is explicitly selected, and coalesced types display once',async()=>{
 const now=Date.now(),w=worker(),p=defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'123',gameId:'123',name:'One',duration:'game',createdAt:now-3600000,expiresAt:now+86400000}]};await w.prefs(p);
 for(const type of ['halftime','close','upsetWatch','confirmedUpset','scoring']){const e={id:`game:123:${type}`,types:[type],teamIds:['1','2'],title:type,body:'Verified scores',url:'/game/123',observedAt:now,expiresAt:now+300000};await w.push(e);assert.equal(w.shown.length,0);}
 p.gameAlerts.following.close=true;p.gameAlerts.following.upsetWatch=true;await w.prefs(p);const late={id:'game:123:late:fourth',types:['close','upsetWatch'],teamIds:['1','2'],title:'Upset Watch',body:'Verified scores',url:'/game/123',observedAt:now,expiresAt:now+300000};await Promise.all([w.push(late),w.push(late)]);assert.equal(w.shown.length,1);
 p.following.enabled=false;p.myTeams.enabled=true;p.favorites=[{id:'1',name:'One'}];p.gameAlerts.favorites.halftime=true;await w.prefs(p);await w.push({...late,id:'game:123:halftime',types:['halftime']});assert.equal(w.shown.length,2);
});

test('per-follow options survive worker restart, override legacy defaults and keep favorite overlap deduplicated',async()=>{
 const db=new IDBFactory(),w=worker(db),now=Date.now(),p=defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'1',name:'Game',duration:'game',gameId:'1',createdAt:now-10000,expiresAt:now+86400000,alerts:{kickoff:false,halftime:true,close:false,scoring:false,final:false,upsetWatch:false,confirmedUpset:false}}]};
 await w.prefs(p);await w.push({...message,observedAt:now});assert.equal(w.shown.length,0);await w.push({...message,id:'game:1:halftime',types:['halftime'],observedAt:now});assert.equal(w.shown.length,1);
 const restarted=worker(db);await restarted.push({...message,id:'game:1:halftime',types:['halftime'],observedAt:now});assert.equal(restarted.shown.length,0);
 p.favorites=[{id:'1',name:'Favorite'}];p.myTeams={enabled:true,kickoff:true,final:true};await restarted.prefs(p);await restarted.push({...message,observedAt:now});await restarted.push({...message,observedAt:now});assert.equal(restarted.shown.length,1);
});

test('national opt-in is independent, suppresses followed games and expires discovery invitations',async()=>{
 const w=worker(),p=defaultAlertPreferences(),now=Date.now(),invite={...message,id:'game:123:discovery',types:['pulseInteresting'],teamIds:['1','2'],observedAt:now,expiresAt:now+60000,discovery:{expiresAt:now+60000},url:'/game/123?follow=1'};await w.prefs(p);await w.push(invite);assert.equal(w.shown.length,0);
 p.pulse.enabled=true;p.pulse.categories.pulseInteresting=true;await w.prefs(p);await w.push({...invite,expiresAt:now-1});assert.equal(w.shown.length,0);p.following={enabled:false,items:[{kind:'team',id:'1',name:'One',duration:'24h',createdAt:now-1000,expiresAt:now+86400000}]};await w.prefs(p);await w.push(invite);assert.equal(w.shown.length,0);p.following.items=[];await w.prefs(p);await Promise.all([w.push(invite),w.push(invite)]);assert.equal(w.shown.length,1);assert.equal(w.shown[0].options.data.url,'/game/123?follow=1');
});
test('national official-ranking preferences reuse published poll identities and do not opt legacy devices in',async()=>{
 const w=worker(),p=defaultAlertPreferences(),rank={...message,id:'poll:ap:2026:9',types:['ap'],teamIds:[],url:'/?ranking=ap#rankings-heading'};await w.prefs(p);await w.push(rank);assert.equal(w.shown.length,0);p.pulse.enabled=true;p.pulse.rankings.ap=true;await w.prefs(p);await w.push(rank);await w.push(rank);assert.equal(w.shown.length,1);assert.equal(w.shown[0].options.data.url,rank.url);
});
