import {test} from 'node:test';
import assert from 'node:assert/strict';
import {subscribeLiveRefresh} from '../app/lib/live-refresh.ts';
test('suspended PWA immediately refreshes on visibility, focus, pageshow and reconnect; hidden timers do not fetch',()=>{
 const doc=Object.assign(new EventTarget(),{hidden:true});
 const win=Object.assign(new EventTarget(),{setInterval:(fn:()=>void,ms:number)=>{assert.equal(ms,60000);tick=fn;return 1;},clearInterval:(id:number)=>{assert.equal(id,1);cleared=true;}});
 let tick=()=>{},calls=0,cleared=false;
 const stop=subscribeLiveRefresh(()=>{calls++;},doc as unknown as Document,win as unknown as Window);
 tick();doc.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,0);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,1);
 for(const name of ['focus','pageshow','online'])win.dispatchEvent(new Event(name));
 assert.equal(calls,4);tick();assert.equal(calls,5);
 stop();assert.equal(cleared,true);doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('focus'));assert.equal(calls,5);
});
