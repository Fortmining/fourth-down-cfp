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
