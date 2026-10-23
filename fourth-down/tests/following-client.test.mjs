import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {IDBFactory} from 'fake-indexeddb';
import * as alerts from '../app/lib/alerts.ts';
function client({control=false,dirty=false,offline=false,workerOk=true,serverStatus=200,diagnosticsOffline=false,indexedDB=new IDBFactory()}={}){
 const values=new Map(),requests=[],workerPreferences=[];
 const prefs=alerts.defaultAlertPreferences();prefs.favorites=[{id:'9',name:'Permanent'}];prefs.myTeams={enabled:true,kickoff:true,final:false};prefs.breaking.enabled=true;prefs.breaking.ap=true;
 values.set('fourth-down-alert-preferences-v1',JSON.stringify(prefs));
 if(control)values.set('fourth-down-push-control-v1',JSON.stringify({id:'test-control',token:'test-capability'}));
 if(dirty)values.set('fourth-down-alert-settings-pending-v1','true');
 const exports={};const source=ts.transpileModule(fs.readFileSync('app/lib/following-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:()=>alerts,Event,setTimeout,clearTimeout,indexedDB,Date,AbortSignal,
  localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},window:{dispatchEvent(){},matchMedia:()=>({matches:true})},
  Notification:{permission:'granted',requestPermission(){throw Error('Unexpected permission prompt');}},
  MessageChannel:class{constructor(){this.port1={onmessage:null,close(){}};this.port2={reply:data=>this.port1.onmessage?.({data})};}},
  navigator:{userAgent:'iPhone',serviceWorker:{getRegistration:async()=>({
   active:{postMessage:(message,ports)=>{workerPreferences.push(message.preferences);ports[0].reply({ok:workerOk});}},
   pushManager:{getSubscription:async()=>({toJSON:()=>({endpoint:'test-only'})})}
  })}},
  fetch:async(url,options)=>{requests.push({url,data:JSON.parse(options.body)});if(offline||(diagnosticsOffline&&url.includes('diagnostics')))throw Error('Offline');return {ok:url.includes('subscription')?serverStatus===200:true,status:url.includes('subscription')?serverStatus:200,json:async()=>({deviceAlias:'test-device',workerFollowCount:1})};}
 });
 return {...exports,values,requests,workerPreferences,prefs};
}
const followCreatedAt=Date.now();
const follow={kind:'team',id:'1',name:'One',duration:'24h',createdAt:followCreatedAt,expiresAt:followCreatedAt+86400000};
test('watchlist persistence without push opt-in never creates a subscription or prompts',async()=>{
 const c=client();await c.saveFollowing([follow]);const saved=c.readPreferences();assert.equal(saved.following.items.length,1);assert.equal(saved.following.enabled,false);assert.deepEqual(JSON.parse(JSON.stringify(saved.favorites)),c.prefs.favorites);assert.deepEqual(saved.breaking,c.prefs.breaking);assert.equal(c.requests.length,0);assert.equal(c.workerPreferences.length,0);
});
test('existing push opt-in is updated, preserving v0.5 categories and using existing capability',async()=>{
 const c=client({control:true});await c.saveFollowing([follow]);assert.equal(c.requests.length,2);assert.equal(c.requests[1].data.attempt.stage,'server-saved');const req=c.requests[0];assert.equal(req.data.action,'following');assert.equal(req.data.token,'test-capability');assert.equal(req.data.preferences,undefined);assert.equal(req.data.following.enabled,false);assert.equal(c.workerPreferences.length,1);assert.equal(c.values.has('fourth-down-following-pending'),false);
});
test('offline unfollow mutes queued local pushes, persists the change, and leaves a retry marker',async()=>{
 const c=client({control:true,offline:true});const p=c.readPreferences();p.following={enabled:true,items:[follow]};c.storePreferences(p);
 await assert.rejects(c.saveFollowing([]));assert.equal(c.readPreferences().following.items.length,0);assert.equal(c.workerPreferences[0].following.items.length,0);assert.equal(c.values.get('fourth-down-following-pending'),'true');
});
test('pending favorite/ranking drafts are never submitted by a following-only patch',async()=>{
 const c=client({control:true,dirty:true});await c.saveFollowing([follow]);assert.equal(c.requests[0].data.action,'following');assert.equal(c.requests[0].data.preferences,undefined);assert.equal(c.values.get('fourth-down-alert-settings-pending-v1'),'true');assert.equal(c.workerPreferences.length,1);
});

test('device inspection recovers a completed follow from old worker storage without rewriting it or enabling push',async()=>{
 const db=new IDBFactory(),p=alerts.defaultAlertPreferences();p.following={enabled:true,items:[follow]};
 await new Promise((resolve,reject)=>{const r=db.open('fourth-down-alerts',2);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onerror=reject;r.onsuccess=()=>{const tx=r.result.transaction('settings','readwrite');tx.objectStore('settings').put(p,'preferences');tx.oncomplete=()=>{r.result.close();resolve();};};});
 const c=client({control:true,indexedDB:db});const before=JSON.stringify(c.readPreferences());const result=await c.inspectThisDevice();assert.match(result,/Device report saved/);assert.equal(c.requests.length,1);assert.equal(c.requests[0].url,'/api/alerts/diagnostics');assert.equal(c.requests[0].data.workerFollowing.items[0].createdAt,follow.createdAt);assert.equal(c.requests[0].data.platform,'ios');assert.equal(c.workerPreferences.length,0);assert.equal(JSON.stringify(c.readPreferences()),before);
});
test('offline follow synchronization retains original creation time and failure stage for later inspection',async()=>{
 const c=client({control:true,offline:true});await assert.rejects(c.saveFollowing([follow]));
 const history=JSON.parse(c.values.get('fourth-down-following-sync-history-v1'));assert.deepEqual(history.map(a=>a.stage),['started','server-save-failed']);assert.equal(history[1].following.items[0].createdAt,follow.createdAt);
 assert.equal(c.values.get('fourth-down-following-pending'),'true');assert.equal(c.requests[0].url,'/api/alerts/subscription');assert.equal(c.requests[1].url,'/api/alerts/diagnostics');assert.equal(c.requests[1].data.attempt.stage,'server-save-failed');
});
test('worker failure and rejected server save retain exact stages and pending changes',async()=>{
 for(const [options,stage] of [[{workerOk:false},'worker-save-failed'],[{serverStatus:503},'server-save-failed']]){
  const c=client({control:true,...options});await assert.rejects(c.saveFollowing([follow]));const history=JSON.parse(c.values.get('fourth-down-following-sync-history-v1'));
  assert.equal(history.at(-1).stage,stage);if(options.serverStatus)assert.equal(history.at(-1).httpStatus,503);assert.equal(c.values.get('fourth-down-following-pending'),'true');
 }
});
test('telemetry failure cannot turn a successful follow save into a failure or request push permission',async()=>{
 const c=client({control:true,diagnosticsOffline:true});assert.match(await c.saveFollowing([follow]),/Watchlist saved/);assert.equal(c.values.has('fourth-down-following-pending'),false);
 assert.equal(JSON.parse(c.values.get('fourth-down-following-sync-history-v1')).at(-1).stage,'server-saved');
});
