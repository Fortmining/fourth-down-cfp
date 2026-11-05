import {readPreferences} from './following-client';
import {followAlertTypes,followChoices} from './alerts';
const KEY='fourth-down-follow-registration-v1';
const CONTROL='fourth-down-push-control-v1';
function signature(){return JSON.stringify(readPreferences().following);}
export function registrationStatus(){
 const p=readPreferences();
 if(!p.following?.enabled)return 'Following alerts are paused on this device.';
 if(!p.following.items.some(f=>followAlertTypes.some(t=>followChoices(p,f)[t])))return 'Watchlist only · no game alerts selected.';
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null');
  const control=JSON.parse(localStorage.getItem(CONTROL)||'null');
  if(saved?.id===control?.id&&saved.signature===signature()&&localStorage.getItem('fourth-down-worker-pending')!=='true')
   return 'Alerts registered for this device · server confirmed '+new Date(saved.at).toLocaleString()+'.';
 }catch{}
 return 'Alert registration is unconfirmed. Retry registration before closing the app.';
}
export async function verifyFollowRegistration(){
 localStorage.removeItem(KEY);
 const control=JSON.parse(localStorage.getItem(CONTROL)||'null');
 if(!control)throw Error('Enable notifications on this device to register game alerts.');
 const expected=signature();
 const response=await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),body:JSON.stringify({action:'verify',...control})});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Could not verify saved alerts. Retry registration.');
 if(expected!==signature()||JSON.stringify(result.following)!==expected)throw Error('This device’s follows do not match the server. Retry registration.');
 localStorage.setItem(KEY,JSON.stringify({id:control.id,signature:expected,at:Date.now()}));
 return registrationStatus();
}
