import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as alerts from '../app/lib/alerts.ts';
function client({control=true,offline=false,rejected=false,workerOk=true,permission='granted',grant='granted',storageFailure=false}={}){
 const values=new Map(),requests=[],worker=[];let prompts=0,subscribes=0,unsubscribes=0;const subscription={toJSON:()=>({endpoint:'https://web.push.apple.com/test'}),unsubscribe:async()=>{unsubscribes++;return true;}};
 const initial=alerts.defaultAlertPreferences();initial.favorites=[{id:'9',name:'Permanent'}];initial.myTeams={enabled:true,kickoff:true,final:true};initial.breaking={...initial.breaking,enabled:true,ap:true};
 values.set('fourth-down-alert-preferences-v1',JSON.stringify(initial));values.set('fourth-down-alert-draft-v071',JSON.stringify({...initial,breaking:{...initial.breaking,ap:false}}));
 if(control)values.set('fourth-down-push-control-v1',JSON.stringify({id:'cap',token:'secret'}));
 const following={PREFS:'fourth-down-alert-preferences-v1',CHANGED:'changed',readPreferences:()=>alerts.normalizePreferences(JSON.parse(values.get('fourth-down-alert-preferences-v1')))};
 const source=ts.transpileModule(fs.readFileSync('app/lib/notification-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};
 vm.runInNewContext(source,{exports,require:name=>name.includes('following-client')?following:alerts,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(storageFailure&&k==='fourth-down-push-control-v1')throw Error('Storage blocked');values.set(k,v);},removeItem:k=>values.delete(k)},window:{Notification:{},PushManager:{},dispatchEvent(){}},Notification:{permission,requestPermission:async()=>{prompts++;return grant;}},atob,navigator:{serviceWorker:{register:async()=>({pushManager:{getSubscription:async()=>null,subscribe:async()=>{subscribes++;return subscription;}}}),ready:Promise.resolve(),getRegistration:async()=>({active:{postMessage:(data,ports)=>{worker.push(data.preferences);ports[0].reply({ok:workerOk});}}})}},MessageChannel:class{constructor(){this.port1={onmessage:null,close(){}};this.port2={reply:data=>this.port1.onmessage({data})};}},Event,setTimeout,clearTimeout,Date,fetch:async(url,options)=>{if(url.endsWith('/config'))return {ok:true,json:async()=>({available:true,publicKey:'AQAB'})};const data=JSON.parse(options.body);requests.push({url,data});if(offline)throw Error('Offline');return {ok:!rejected,json:async()=>rejected?{error:'Retry saving'}:{id:'cap',token:'secret',preferences:data.action==='following'?{...initial,following:data.following}:data.preferences}};}});
 return {...exports,values,requests,worker,initial,prompts:()=>prompts,subscribes:()=>subscribes,unsubscribes:()=>unsubscribes};
}
const now=Date.now(),follow={kind:'game',id:'123',name:'Game',duration:'game',gameId:'123',createdAt:now-1000,expiresAt:now+86400000,alerts:{kickoff:true,final:true,halftime:true,close:false,scoring:false,upsetWatch:false,confirmedUpset:false}};
test('confirmed follow saves preferences together without submitting favorite or ranking drafts',async()=>{
 const c=client();assert.match(await c.persistFollow(follow),/confirmed by the server/);assert.equal(c.requests[0].data.action,'following');assert.equal(c.requests[0].data.preferences,undefined);assert.deepEqual(c.requests[0].data.following.items[0].alerts,follow.alerts);const saved=JSON.parse(c.values.get('fourth-down-alert-preferences-v1'));assert.deepEqual(saved.favorites,c.initial.favorites);assert.equal(saved.breaking.ap,true);assert.ok(c.values.has('fourth-down-alert-draft-v071'));assert.equal(c.worker[0].following.items[0].alerts.halftime,true);assert.equal(c.prompts(),0);
});
test('offline and rejected atomic follow saves never commit locally or change worker delivery',async()=>{
 for(const options of [{offline:true},{rejected:true}]){const c=client(options);await assert.rejects(c.persistFollow(follow));assert.equal(c.requests.length,1);assert.equal(c.worker.length,0);assert.equal(JSON.parse(c.values.get('fourth-down-alert-preferences-v1')).following.items.length,0);assert.ok(c.values.has('fourth-down-alert-draft-v071'));}
});
test('server persistence is reported separately from a device worker failure and can be retried',async()=>{
 const c=client({workerOk:false});assert.match(await c.persistFollow(follow),/Saved on the server.*Retry/);assert.equal(c.values.get('fourth-down-worker-pending'),'true');assert.equal(JSON.parse(c.values.get('fourth-down-alert-preferences-v1')).following.items.length,1);
});
test('blocked permission is graceful; watchlist-only saves do not prompt or subscribe',async()=>{
 const c=client({control:false,permission:'denied'});await assert.rejects(c.persistFollow(follow),/blocked/);assert.equal(c.requests.length,0);const muted={...follow,alerts:Object.fromEntries(alerts.followAlertTypes.map(t=>[t,false]))};assert.match(await c.persistFollow(muted),/Notifications are off/);assert.equal(c.prompts(),0);assert.equal(c.requests.length,0);assert.equal(JSON.parse(c.values.get('fourth-down-alert-preferences-v1')).following.enabled,false);
});
test('saving a new opted-in follow does not silently opt existing muted follows in',async()=>{
 const c=client();const p=JSON.parse(c.values.get('fourth-down-alert-preferences-v1'));p.following={enabled:false,items:[{...follow,id:'456',gameId:'456',alerts:undefined}]};c.values.set('fourth-down-alert-preferences-v1',JSON.stringify(p));await c.persistFollow(follow);const items=c.requests[0].data.following.items;assert.ok(Object.values(items[0].alerts).every(v=>v===false));assert.equal(items[1].alerts.halftime,true);
});
test('new push subscription requires the explicit confirm permission gesture and saves selected follow atomically',async()=>{
 const c=client({control:false,permission:'default'});assert.equal(c.prompts(),0);assert.equal(c.subscribes(),0);assert.match(await c.persistFollow(follow),/confirmed by the server/);assert.equal(c.prompts(),1);assert.equal(c.subscribes(),1);assert.equal(c.requests[0].data.action,'create');assert.equal(c.requests[0].data.preferences.following.items[0].alerts.halftime,true);assert.ok(c.values.has('fourth-down-push-control-v1'));
});
test('failed initial server save rolls back newly created browser subscription and retains follow draft',async()=>{
 const c=client({control:false,rejected:true});await assert.rejects(c.persistFollow(follow));assert.equal(c.subscribes(),1);assert.equal(c.unsubscribes(),1);assert.equal(c.values.has('fourth-down-push-control-v1'),false);assert.equal(JSON.parse(c.values.get('fourth-down-alert-preferences-v1')).following.items.length,0);
});
test('blocked capability storage removes a just-created server subscription and browser subscription',async()=>{
 const c=client({control:false,storageFailure:true});await assert.rejects(c.persistFollow(follow),/storage is blocked/);assert.equal(c.requests[0].data.action,'create');assert.equal(c.requests[1].data.action,'delete');assert.equal(c.unsubscribes(),1);assert.equal(c.values.has('fourth-down-push-control-v1'),false);
});
test('national preference save failure leaves committed preferences untouched and draft available for retry',async()=>{const c=client({offline:true}),p=structuredClone(c.initial);p.pulse.enabled=true;p.pulse.categories.pulseClose=true;await assert.rejects(c.persistNotifications(p));assert.equal(JSON.parse(c.values.get('fourth-down-alert-preferences-v1')).pulse.enabled,false);assert.ok(c.values.has('fourth-down-alert-draft-v071'));assert.equal(c.worker.length,0);});
test('server-confirmed national preferences persist independently of favorite and temporary selections',async()=>{const c=client(),p=structuredClone(c.initial);p.pulse.enabled=true;p.pulse.categories.pulseClose=true;assert.match(await c.persistNotifications(p),/confirmed by the server/);const saved=JSON.parse(c.values.get('fourth-down-alert-preferences-v1'));assert.equal(saved.pulse.categories.pulseClose,true);assert.deepEqual(saved.favorites,c.initial.favorites);assert.deepEqual(saved.following,c.initial.following);assert.equal(c.values.has('fourth-down-alert-draft-v071'),false);});
