import { createHash, timingSafeEqual } from 'node:crypto';
import type { PushSubscription } from 'web-push';
import { followsType,extraGameTypes,normalizePreferences, type AlertPreferences, type AlertType } from './alerts';
import type {KickoffAccess} from './kickoff-recovery';
export const SUBS='fd:v05:subscriptions';
export type SavedSubscription={id:string;tokenHash:string;subscription:PushSubscription;preferences:AlertPreferences;typeSince:Record<AlertType,number>;updatedAt:number;kickoffAccess?:KickoffAccess;gameAccess?:Record<string,number>};
const storageUrl=()=>process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const storageToken=()=>process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export function pushConfigured() {return !!storageUrl() && !!storageToken() && ['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','CRON_SECRET'].every(key=>!!process.env[key]);}
export async function redis(...command:(string|number)[]) {
 const base=storageUrl();
 if(!base || !base.startsWith('https://') || !storageToken())throw Error('Storage unavailable');
 const r=await fetch(base,{method:'POST',headers:{Authorization:`Bearer ${storageToken()}`,'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error('Storage unavailable');
 const data=await r.json();if(data.error)throw Error('Storage unavailable');return data.result;
}
export function tokenHash(token:string) {return createHash('sha256').update(token).digest('hex');}
export function sameToken(token:string,hash:string) {const a=Buffer.from(tokenHash(token)),b=Buffer.from(hash);return a.length===b.length&&timingSafeEqual(a,b);}
export function validPushSubscription(s:unknown):s is PushSubscription {
 try {
  const x=s as PushSubscription;const u=new URL(x.endpoint);
  const host=u.hostname;
  const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.notify.windows.com');
  return allowed && u.protocol==='https:' && !u.username && !u.password && !u.port && !u.hash && x.endpoint.length<2000 &&
   typeof x.keys?.auth==='string'&&/^[A-Za-z0-9_-]{22}$/.test(x.keys.auth)&&typeof x.keys.p256dh==='string'&&/^[A-Za-z0-9_-]{87}$/.test(x.keys.p256dh);
 }catch{return false;}
}
export function typeFlags(p:AlertPreferences):Record<AlertType,boolean> {
 const extra=Object.fromEntries(extraGameTypes.map(type=>[type,!!(p.myTeams.enabled&&p.favorites.length&&p.gameAlerts?.favorites[type])||!!(p.following?.enabled&&p.following.items.some(f=>f.expiresAt>Date.now()&&followsType(p,f,type)))])) as Record<typeof extraGameTypes[number],boolean>;
 return {...extra,kickoff:!!(p.following?.enabled&&p.following.items.some(f=>f.expiresAt>Date.now()&&followsType(p,f,'kickoff')))||p.myTeams.enabled&&p.favorites.length>0&&p.myTeams.kickoff,final:!!(p.following?.enabled&&p.following.items.some(f=>f.expiresAt>Date.now()&&followsType(p,f,'final')))||p.myTeams.enabled&&p.favorites.length>0&&p.myTeams.final,
 upset:p.breaking.enabled&&p.breaking.upsets,development:p.breaking.enabled&&p.breaking.developments,
 ap:p.breaking.enabled&&p.breaking.ap,coaches:p.breaking.enabled&&p.breaking.coaches,cfp:p.breaking.enabled&&p.breaking.cfp};
}
export function activationTimes(old:SavedSubscription|null,p:AlertPreferences,now:number):Record<AlertType,number> {
 const flags=typeFlags(p),before=old?typeFlags(old.preferences):null;
 const favoriteChange=!!old&&JSON.stringify(old.preferences.favorites.map(t=>t.id).sort())!==JSON.stringify(p.favorites.map(t=>t.id).sort());
 return Object.fromEntries((Object.keys(flags) as AlertType[]).map(type=>[type,flags[type]&&before?.[type]&&!(favoriteChange&&(type==='kickoff'||type==='final'))?old!.typeSince[type]:now])) as Record<AlertType,number>;
}
export async function loadSubscription(id:string):Promise<SavedSubscription|null> {const value=await redis('HGET',SUBS,id);return value?JSON.parse(value):null;}
export function safePreferences(value:unknown) {return normalizePreferences(value);}

export function cronAuthorized(request:Request) {const a=Buffer.from(request.headers.get('authorization')||'');const b=Buffer.from(`Bearer ${process.env.CRON_SECRET||''}`);return !!process.env.CRON_SECRET&&a.length===b.length&&timingSafeEqual(a,b);}

// Bounded, private audit history survives one-game cleanup. Never store push keys.
export async function appendDeliveryAudit(id:string,entry:Record<string,unknown>){
 return appendPrivateAudit(`fd:v06:audit:${id}`,entry,200);
}
export const appendKickoffAudit=(id:string,gameId:string,entry:Record<string,unknown>)=>appendPrivateAudit(`fd:v06:kickoff:${id}:${gameId}`,entry,2000);
export const appendSchedulerAudit=(entry:Record<string,unknown>)=>appendPrivateAudit('fd:v06:scheduler',entry,24000);
async function appendPrivateAudit(key:string,entry:Record<string,unknown>,limit:number){
 try{await redis('LPUSH',key,JSON.stringify({at:new Date().toISOString(),...entry}));await redis('LTRIM',key,0,limit-1);await redis('EXPIRE',key,60*60*24*30);return true;}
 catch{console.warn('Notification audit write unavailable',JSON.stringify({kind:entry.kind,runId:entry.runId,gameId:entry.gameId,decision:entry.decision}));return false;}
}
