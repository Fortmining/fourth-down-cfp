import {remainingFollows,type AlertFeed} from '../../../lib/alerts';
import { NextResponse } from 'next/server';
import { randomBytes,createHash } from 'node:crypto';
import { appendDeliveryAudit,activationTimes,loadSubscription,pushConfigured,redis,sameToken,safePreferences,SUBS,tokenHash,validPushSubscription } from '../../../lib/push-store';
import {kickoffAccessTimes} from '../../../lib/kickoff-recovery';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request) {
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin rejected'},403);
 if(!pushConfigured())return reply({error:'Background alerts are not available yet.'},503);
 try {
  const text=await request.text();if(text.length>32_000)return reply({error:'Request too large'},413);
  const data=JSON.parse(text);const {action,id,token}=data;
  if(!['create','update','delete'].includes(action))return reply({error:'Invalid action'},400);
  // Mutations use a random per-browser capability; no public subscription lookup.
  let old=null;
  if(action!=='create'){
   if(typeof id!=='string'||!/^\w{64}$/.test(id)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return reply({error:'Invalid subscription'},400);
   old=await loadSubscription(id);
   if(!old){return action==='delete'?reply({ok:true}):reply({error:'Subscription expired; enable alerts again.'},404);}
   if(!sameToken(token,old.tokenHash))return reply({error:'Not authorized'},403);
  }
  if(action==='delete'){await appendDeliveryAudit(id,{kind:'unsubscribed',following:old?.preferences.following});await redis('HDEL',SUBS,id);return reply({ok:true});}
  if(!validPushSubscription(data.subscription))return reply({error:'Invalid push endpoint'},400);
  if(old&&old.subscription.endpoint!==data.subscription.endpoint)return reply({error:'Subscription mismatch'},400);
  const preferences=safePreferences(data.preferences);const now=Date.now();
  const baseline=await redis('GET','fd:v05:baseline');
  if(preferences.following)preferences.following.items=remainingFollows(preferences,baseline?(JSON.parse(baseline) as AlertFeed).games:[],now);
  const newId=createHash('sha256').update(data.subscription.endpoint).digest('hex');
  const newToken=action==='create'?randomBytes(32).toString('hex'):token;
  if(action==='create'){
   const heartbeat=await redis('GET','fd:v05:heartbeat');if(!heartbeat||now-Number(heartbeat)>360_000)return reply({error:'Background checks are unavailable. Please try later.'},503);
   // Never replace another browser's capability for the same endpoint.
   const existing=await loadSubscription(newId);if(existing)return reply({error:'Existing subscription needs its saved controls. Unsubscribe in browser settings and retry.'},409);
   const ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
   const rateKey=`fd:v05:rate:${tokenHash(ip)}:${Math.floor(now/3600000)}`;
   const count=await redis('INCR',rateKey);if(count===1)await redis('EXPIRE',rateKey,3600);
   if(count>10)return reply({error:'Please try again later.'},429);
  }
  const record={id:newId,tokenHash:tokenHash(newToken),subscription:data.subscription,preferences,kickoffAccess:kickoffAccessTimes(old,preferences,now),typeSince:activationTimes(old,preferences,now),updatedAt:now};
  const encoded=JSON.stringify(record);
  if(action==='create'){
   const created=await redis('HSETNX',SUBS,newId,encoded);if(!created)return reply({error:'Subscription already exists'},409);
  }else await redis('HSET',SUBS,id,encoded);
  await appendDeliveryAudit(newId,{kind:'settings-saved',serverSavedAt:now,typeSince:record.typeSince,following:preferences.following,previousFollowing:old?.preferences.following,favorites:preferences.favorites.map(t=>t.id),myTeams:preferences.myTeams,breaking:preferences.breaking});
  return reply({ok:true,id:newId,token:newToken,preferences});
 }catch{return reply({error:'Could not save alert settings. Nothing has been confirmed; try again.'},503);}
}
