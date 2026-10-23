import {normalizePreferences,type AlertPreferences,type TemporaryFollow} from './alerts';
export const PREFS='fourth-down-alert-preferences-v1';
export const CHANGED='fourth-down-preferences-changed';
export function readPreferences(){try{return normalizePreferences(JSON.parse(localStorage.getItem(PREFS)||'null'));}catch{return normalizePreferences(null);}}
export function storePreferences(p:AlertPreferences){localStorage.setItem(PREFS,JSON.stringify(p));window.dispatchEvent(new Event(CHANGED));}
// Never requests permission or creates a push subscription. Reuses explicit opt-in.
export async function saveFollowing(items:TemporaryFollow[]){
 const p=readPreferences();p.following={enabled:p.following?.enabled===true,items};storePreferences(p);
 localStorage.setItem('fourth-down-following-pending','true');
 return syncFollowing();
}
let syncQueue:Promise<unknown>=Promise.resolve();
export function syncFollowing():Promise<string>{
 const next=syncQueue.catch(()=>{}).then(performSyncFollowing);syncQueue=next;return next;
}
async function performSyncFollowing(){
 const p=readPreferences();
 const control=JSON.parse(localStorage.getItem('fourth-down-push-control-v1')||'null');
 if(!control)return 'Watchlist saved. Enable optional following alerts in More > Following.';

 const registration=await navigator.serviceWorker?.getRegistration('/');
 const subscription=await registration?.pushManager.getSubscription();
 if(!registration?.active||!subscription)throw Error('Watchlist saved. Renew notifications in More to update delivery.');
 await new Promise<void>((resolve,reject)=>{
  const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();reject(Error('Watchlist saved. Retry to update alert delivery.'));},5000);
  channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();if(e.data?.ok)resolve();else reject(Error('Watchlist saved. Notification storage unavailable.'));};
  registration.active!.postMessage({type:'alert-preferences',preferences:p},[channel.port2]);
 });
 if(localStorage.getItem('fourth-down-alert-settings-pending-v1')==='true')return 'Watchlist saved. Save alert settings in More to update delivery.';
 const r=await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',...control,subscription:subscription.toJSON(),preferences:p})});
 if(!r.ok)throw Error('Watchlist saved. Retry to update alert delivery.');
 localStorage.removeItem('fourth-down-following-pending');
 return p.following?.enabled?'Watchlist and following alerts updated.':'Watchlist saved. Following alerts are off.';
}

// Remember completed one-game follows locally even after the feed window rolls.
// Keep the worker snapshot untouched here: a queued final may still need display.
export function cleanFinishedFollows(finalIds:string[]){
 const p=readPreferences();if(!p.following)return;
 const items=p.following.items.filter(f=>f.expiresAt>Date.now()&&!(f.duration==='game'&&finalIds.includes(f.gameId||'')));
 if(items.length!==p.following.items.length)storePreferences({...p,following:{...p.following,items}});
}

// Read the old worker snapshot before any update; completed follows may survive here.
export async function inspectThisDevice(){
 const control=JSON.parse(localStorage.getItem('fourth-down-push-control-v1')||'null');
 if(!control)throw Error('Open the installed iPhone app that has notifications enabled, then inspect this device there.');
 const workerFollowing=await new Promise<AlertPreferences['following']>((resolve)=>{
  const request=indexedDB.open('fourth-down-alerts');
  request.onupgradeneeded=()=>request.transaction?.abort();
  request.onerror=()=>resolve(undefined);
  request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('settings')){db.close();resolve(undefined);return;}const tx=db.transaction('settings','readonly');const get=tx.objectStore('settings').get('preferences');get.onsuccess=()=>resolve(normalizePreferences(get.result).following);get.onerror=()=>resolve(undefined);tx.oncomplete=()=>db.close();};
 });
 const registration=await navigator.serviceWorker?.getRegistration('/');
 const response=await fetch('/api/alerts/diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
  ...control,clientNow:Date.now(),workerFollowing,localFollowing:readPreferences().following,
  pendingSettings:localStorage.getItem('fourth-down-alert-settings-pending-v1')==='true',followingPending:localStorage.getItem('fourth-down-following-pending')==='true',
  permission:typeof Notification==='undefined'?'unsupported':Notification.permission,
  standalone:window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true,
  platform:/iPhone|iPad|iPod/.test(navigator.userAgent)?'ios':/Macintosh/.test(navigator.userAgent)?'macos':'other',workerPresent:!!registration?.active
 })});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Could not save device diagnostics.');
 return `Device report saved for ${result.deviceAlias}. Recovered ${result.workerFollowCount} stored worker follow(s). No settings changed and no notification was sent.`;
}
