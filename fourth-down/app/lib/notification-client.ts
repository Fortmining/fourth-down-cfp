import {hasAlerts,normalizePreferences,type AlertPreferences,type TemporaryFollow,followAlertTypes,followChoices} from './alerts';
import {PREFS,CHANGED,readPreferences} from './following-client';
export const DRAFT='fourth-down-alert-draft-v071';
export const CONTROL='fourth-down-push-control-v1';
export type PushControl={id:string;token:string};
export function readControl():PushControl|null {try{return JSON.parse(localStorage.getItem(CONTROL)||'null');}catch{return null;}}
export async function writeWorker(p:AlertPreferences){
 let registration=await navigator.serviceWorker?.getRegistration('/');if(!registration?.active)throw Error('Device notification worker is unavailable. Renew notifications on this device.');
 // Load the current worker before sending per-follow options to an older installed PWA.
 if(registration.update){await registration.update();const installing=registration.installing||registration.waiting;if(installing)await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>{installing.removeEventListener('statechange',changed);reject(Error('Device worker update needs retry.'));},8000);function changed(){if(installing!.state==='activated'){clearTimeout(timeout);installing!.removeEventListener('statechange',changed);resolve();}else if(installing!.state==='redundant'){clearTimeout(timeout);reject(Error('Device worker update needs retry.'));}}installing.addEventListener('statechange',changed);changed();});registration=await navigator.serviceWorker.getRegistration('/');if(!registration?.active)throw Error('Device delivery controls need retry.');}
 await new Promise<void>((resolve,reject)=>{const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();reject(Error('Device delivery controls need retry.'));},5000);channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();if(e.data?.ok)resolve();else reject(Error('Device delivery controls need retry.'));};registration.active!.postMessage({type:'alert-preferences',preferences:p},[channel.port2]);});
}
function commit(p:AlertPreferences){localStorage.setItem(PREFS,JSON.stringify(p));window.dispatchEvent(new Event(CHANGED));}
function keyBytes(key:string){return Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
// This is called directly by an explicit Save / Confirm gesture. Never by background sync.
export async function persistNotifications(p:AlertPreferences,followingOnly=false):Promise<string>{
 const control=readControl();const wantsFollowing=!!p.following?.enabled&&p.following.items.some(f=>followAlertTypes.some(t=>followChoices(p,f)[t]));
 if(!control&&((followingOnly&&!wantsFollowing)||(!followingOnly&&!hasAlerts(p)))){commit(followingOnly?{...readPreferences(),following:p.following}:p);if(!followingOnly){localStorage.removeItem(DRAFT);localStorage.removeItem('fourth-down-alert-settings-pending-v1');}return 'Saved on this device. Notifications are off; no server subscription is active.';}
 // An existing capability is sufficient to edit or mute delivery, even when permission is blocked.
 if(control){
  if(followingOnly&&localStorage.getItem('fourth-down-alert-settings-pending-v1')==='true'&&!localStorage.getItem(DRAFT))localStorage.setItem(DRAFT,JSON.stringify(readPreferences()));
  const response=await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(followingOnly?{action:'following',...control,following:p.following}:{action:'update',...control,preferences:p})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Save failed. Your changes are still here; retry.');
  const saved=normalizePreferences(result.preferences);try{commit(saved);}catch{throw Error('Saved on the server, but device storage could not be updated. Keep your changes and retry.');}localStorage.removeItem('fourth-down-following-pending');
  if(!followingOnly){localStorage.removeItem(DRAFT);localStorage.removeItem('fourth-down-alert-settings-pending-v1');}
  try{await writeWorker(saved);localStorage.removeItem('fourth-down-worker-pending');}catch{localStorage.setItem('fourth-down-worker-pending','true');return 'Saved on the server. Retry saving to refresh device delivery controls.';}
  return 'Saved. Your notification choices are confirmed by the server.';
 }
 if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('Push is unavailable here. On iPhone open the Home Screen app, or turn off notification choices to save a watchlist-only follow.');
 if(Notification.permission==='denied')throw Error('Notifications are blocked in device settings. Allow them there, or turn off notification choices to save a watchlist-only follow.');
 const grant=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(grant!=='granted')throw Error('Permission was not granted. Your changes are still here. Allow notifications, or turn off notification choices.');
 let created:PushSubscription|null=null;let serverSaved=false;
 try{
  const configResponse=await fetch('/api/alerts/config',{cache:'no-store'});const config=await configResponse.json();if(!configResponse.ok||!config.available||!config.publicKey)throw Error('Notification service is unavailable. Retry when connected.');
  const registration=await navigator.serviceWorker.register('/alerts-sw.js',{scope:'/'});await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription){if(control)throw Error('This device needs notification renewal in More → Notifications. Your follow has not changed.');subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.publicKey)});created=subscription;}
  const response=await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',subscription:subscription.toJSON(),preferences:p})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Save failed. Retry when connected.');
  serverSaved=true;const saved=normalizePreferences(result.preferences);try{localStorage.setItem(CONTROL,JSON.stringify({id:result.id,token:result.token}));}catch{const rollback=await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:result.id,token:result.token})});if(rollback.ok){serverSaved=false;throw Error('Device storage is blocked. Alerts were not enabled; allow storage and retry.');}throw Error('Server saved alerts but device storage failed. Revoke notifications in device settings and retry.');}commit(saved);
  localStorage.removeItem('fourth-down-following-pending');
  if(!followingOnly){localStorage.removeItem(DRAFT);localStorage.removeItem('fourth-down-alert-settings-pending-v1');}
  try{await writeWorker(saved);localStorage.removeItem('fourth-down-worker-pending');}catch{localStorage.setItem('fourth-down-worker-pending','true');return 'Saved on the server. Reopen Notifications and retry saving to refresh this device’s delivery controls.';}
  return 'Saved. Your notification choices are confirmed by the server.';
 }catch(e){if(created&&!serverSaved)await created.unsubscribe().catch(()=>false);if(serverSaved)throw Error('Saved on the server, but device storage could not be updated. Retry saving on this device.');throw e;}
}
export async function persistFollow(follow:TemporaryFollow){
 const p=readPreferences(),items=(p.following?.items||[]).filter(f=>!(f.kind===follow.kind&&f.id===follow.id)&&f.expiresAt>Date.now());
 if(items.length>=40)throw Error('You have 40 follows. Remove one in More → Following and retry.');
 const enabled=followAlertTypes.some(t=>follow.alerts?.[t]);
 // Turning on this follow must not silently enable previously muted follows.
 if(enabled&&!p.following?.enabled)for(const f of items)f.alerts=Object.fromEntries(followAlertTypes.map(t=>[t,false])) as ReturnType<typeof followChoices>;
 p.following={enabled:p.following?.enabled===true||enabled,items:[...items,follow]};return persistNotifications(p,true);
}
