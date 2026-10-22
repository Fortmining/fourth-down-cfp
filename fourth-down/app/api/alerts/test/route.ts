import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { hasAlerts } from '../../../lib/alerts';
import { loadSubscription,pushConfigured,redis,sameToken,tokenHash } from '../../../lib/push-store';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origin rejected'},403);
 if(!pushConfigured())return json({error:'Delivery is unavailable'},503);
 try{
  const text=await request.text();if(text.length>1000)return json({error:'Request too large'},413);
  const {id,token,mode}=JSON.parse(text);
  if(mode!==undefined&&mode!=='background')return json({error:'Invalid test mode'},400);
  if(typeof id!=='string'||!/^\w{64}$/.test(id)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return json({error:'Invalid subscription'},400);
  const sub=await loadSubscription(id);
  if(!sub||!sameToken(token,sub.tokenHash))return json({error:'Not authorized'},403);
  if(!hasAlerts(sub.preferences))return json({error:'Select and save alert settings first'},400);
  if(mode==='background'){const heartbeat=await redis('GET','fd:v05:heartbeat');if(!heartbeat||Date.now()-Number(heartbeat)>360_000)return json({error:'Scheduled checks are unavailable. Try again later.'},503);}
  if(!await redis('SET',`fd:v05:test-rate:${id}`,'1','NX','EX',60))return json({error:'Wait a minute before another test'},429);
  const receipt=randomBytes(32).toString('hex');const eventId=`test:${randomBytes(16).toString('hex')}`;
  if(mode==='background'){
   const now=Date.now();const queued=await redis('HSETNX','fd:v05:background-tests',id,JSON.stringify({eventId,receipt,dueAt:now+60_000,expiresAt:now+600_000}));
   if(!queued)return json({error:'A background test is already queued for this device. Close the app and wait for the scheduled check.'},409);
   return json({ok:true,message:'Background test queued. Close Fourth Down or lock your phone now. The scheduled check should send a clearly labeled test in about 1–5 minutes.'});
  }
  await redis('SET',`fd:v05:receipt:${tokenHash(receipt)}`,JSON.stringify({id,kind:'immediate'}),'EX',300);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
  await webpush.sendNotification(sub.subscription,JSON.stringify({id:eventId,test:true,types:[],teamIds:[],title:'Fourth Down · Test notification',body:'This is a delivery test, not a game or breaking-news alert.',url:'/#alerts',receipt}),{TTL:300,urgency:'normal',timeout:5000});
  return json({ok:true,message:'Test sent to the push provider. Check this device for the notification; provider acceptance alone does not confirm display.'});
 }catch{return json({error:'Could not confirm test delivery. Check permission and try again later.'},503);}
}
