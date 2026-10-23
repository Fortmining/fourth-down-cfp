import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {IDBFactory} from 'fake-indexeddb';
import * as alerts from '../app/lib/alerts.ts';
function client({control=false,dirty=false,offline=false,indexedDB=new IDBFactory()}={}){
 const values=new Map(),requests=[],workerPreferences=[];
 const prefs=alerts.defaultAlertPreferences();prefs.favorites=[{id:'9',name:'Permanent'}];prefs.myTeams={enabled:true,kickoff:true,final:false};prefs.breaking.enabled=true;prefs.breaking.ap=true;
 values.set('fourth-down-alert-preferences-v1',JSON.stringify(prefs));
 if(control)values.set('fourth-down-push-control-v1',JSON.stringify({id:'test-control',token:'test-capability'}));
 if(dirty)values.set('fourth-down-alert-settings-pending-v1','true');
 const exports={};const source=ts.transpileModule(fs.readFileSync('app/lib/following-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:()=>alerts,Event,setTimeout,clearTimeout,indexedDB,Date,
  localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},window:{dispatchEvent(){},matchMedia:()=>({matches:true})},
  Notification:{permission:'granted',requestPermission(){throw Error('Unexpected permission prompt');}},
  MessageChannel:class{constructor(){this.port1={onmessage:null,close(){}};this.port2={reply:data=>this.port1.onmessage?.({data})};}},
  navigator:{userAgent:'iPhone',serviceWorker:{getRegistration:async()=>({
   active:{postMessage:(message,ports)=>{workerPreferences.push(message.preferences);ports[0].reply({ok:true});}},
   pushManager:{getSubscription:async()=>({toJSON:()=>({endpoint:'test-only'})})}
  })}},
  fetch:async(url,options)=>{requests.push({url,data:JSON.parse(options.body)});if(offline)throw Error('Offline');return {ok:true,json:async()=>({deviceAlias:'test-device',workerFollowCount:1})};}
 });
 return {...exports,values,requests,workerPreferences,prefs};
}
const followCreatedAt=Date.now();
const follow={kind:'team',id:'1',name:'One',duration:'24h',createdAt:followCreatedAt,expiresAt:followCreatedAt+86400000};
test('watchlist persistence without push opt-in never creates a subscription or prompts',async()=>{
 const c=client();await c.saveFollowing([follow]);const saved=c.readPreferences();assert.equal(saved.following.items.length,1);assert.equal(saved.following.enabled,false);assert.deepEqual(JSON.parse(JSON.stringify(saved.favorites)),c.prefs.favorites);assert.deepEqual(saved.breaking,c.prefs.breaking);assert.equal(c.requests.length,0);assert.equal(c.workerPreferences.length,0);
});
test('existing push opt-in is updated, preserving v0.5 categories and using existing capability',async()=>{
 const c=client({control:true});await c.saveFollowing([follow]);assert.equal(c.requests.length,1);const req=c.requests[0];assert.equal(req.data.action,'update');assert.equal(req.data.token,'test-capability');assert.deepEqual(req.data.preferences.myTeams,c.prefs.myTeams);assert.deepEqual(req.data.preferences.breaking,c.prefs.breaking);assert.equal(req.data.preferences.following.enabled,false);assert.equal(c.workerPreferences.length,1);assert.equal(c.values.has('fourth-down-following-pending'),false);
});
test('offline unfollow mutes queued local pushes, persists the change, and leaves a retry marker',async()=>{
 const c=client({control:true,offline:true});const p=c.readPreferences();p.following={enabled:true,items:[follow]};c.storePreferences(p);
 await assert.rejects(c.saveFollowing([]));assert.equal(c.readPreferences().following.items.length,0);assert.equal(c.workerPreferences[0].following.items.length,0);assert.equal(c.values.get('fourth-down-following-pending'),'true');
});
test('pending v0.5 settings require explicit save; following changes never silently submit them',async()=>{
 const c=client({control:true,dirty:true});const result=await c.saveFollowing([follow]);assert.match(result,/Save alert settings/);assert.equal(c.requests.length,0);assert.equal(c.workerPreferences.length,1);assert.equal(c.values.get('fourth-down-alert-settings-pending-v1'),'true');
});

test('device inspection recovers a completed follow from old worker storage without rewriting it or enabling push',async()=>{
 const db=new IDBFactory(),p=alerts.defaultAlertPreferences();p.following={enabled:true,items:[follow]};
 await new Promise((resolve,reject)=>{const r=db.open('fourth-down-alerts',2);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onerror=reject;r.onsuccess=()=>{const tx=r.result.transaction('settings','readwrite');tx.objectStore('settings').put(p,'preferences');tx.oncomplete=()=>{r.result.close();resolve();};};});
 const c=client({control:true,indexedDB:db});const before=JSON.stringify(c.readPreferences());const result=await c.inspectThisDevice();assert.match(result,/Device report saved/);assert.equal(c.requests.length,1);assert.equal(c.requests[0].url,'/api/alerts/diagnostics');assert.equal(c.requests[0].data.workerFollowing.items[0].createdAt,follow.createdAt);assert.equal(c.requests[0].data.platform,'ios');assert.equal(c.workerPreferences.length,0);assert.equal(JSON.stringify(c.readPreferences()),before);
});
