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
