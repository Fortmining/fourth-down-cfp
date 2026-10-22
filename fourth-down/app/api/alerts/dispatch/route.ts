import { NextResponse } from 'next/server';
import { timingSafeEqual,randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { GET as liveFeed } from '../../live/route';
import { deriveAlertEvents,selectedEvent,type AlertFeed,type ConfirmedDevelopment } from '../../../lib/alerts';
import { loadSubscription,pushConfigured,redis,SUBS,type SavedSubscription } from '../../../lib/push-store';
import developments from '../../../data/confirmed-developments.json';
export const dynamic='force-dynamic';
export const maxDuration=60;
function authorized(request:Request) {
 const a=Buffer.from(request.headers.get('authorization')||'');const b=Buffer.from(`Bearer ${process.env.CRON_SECRET||''}`);
 return !!process.env.CRON_SECRET&&a.length===b.length&&timingSafeEqual(a,b);
}
export async function GET(request:Request) {
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!authorized(request))return json({error:'Not authorized'},401);
 if(!pushConfigured())return json({error:'Push configuration incomplete'},503);
 const owner=randomBytes(16).toString('hex');
 const lock='fd:v05:dispatch-lock';let locked=false;
 try {
  locked=!!await redis('SET',lock,owner,'NX','EX',120);if(!locked)return json({skipped:'Already running'});
  const response=await liveFeed();if(!response.ok)throw Error('Feed unavailable');
  const feed=await response.json() as AlertFeed;
  const previous=await redis('GET','fd:v05:baseline');
  const events=deriveAlertEvents(previous?JSON.parse(previous):null,feed,developments as ConfirmedDevelopment[]);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
  let sent=0,failed=0;
  // Bounded scan; monitor multiple invocations for larger audiences. All keys
  // share a server-side claim per event/subscription, so overlapping scans dedupe.
  let cursor='0';let scanned=0;
  do {
   const [next,items]=await redis('HSCAN',SUBS,cursor,'COUNT',100);cursor=next;
   for(let i=0;i<items.length;i+=2){
    const record=JSON.parse(items[i+1]) as SavedSubscription;scanned++;
    for(const event of events){
     // Re-read immediately before delivery so settings/unsubscribe take effect.
     const current=await loadSubscription(record.id);if(!current)continue;
     const types=event.types.filter(type=>event.observedAt>=current.typeSince[type]);
     if(!types.length||!selectedEvent({...event,types},current.preferences))continue;
     const claim=`fd:v05:sent:${record.id}:${event.id}`;
     if(!await redis('SET',claim,'claimed','NX','EX',60*60*24*400))continue;
     try {
      await webpush.sendNotification(current.subscription,JSON.stringify({...event,types}),{TTL:300,urgency:'normal',timeout:5000});sent++;
     }catch(error){
      failed++;
      const status=(error as {statusCode?:number}).statusCode;
      if(status===404||status===410){await redis('HDEL',SUBS,record.id);break;}
      // Keep claim after an ambiguous timeout: favor no duplicates over retrying
      // a notification that a provider may already have accepted.
     }
    }
   }
   if(scanned>1000)throw Error('Audience needs a dedicated delivery queue');
  }while(cursor!=='0');
  await redis('SET','fd:v05:baseline',JSON.stringify(feed),'EX',60*60*24*14);
  await redis('SET','fd:v05:heartbeat',String(Date.now()),'EX',420);
  return json({sent,failed,events:events.length,baseline:!previous},failed?502:200);
 }catch{return json({error:'Background check did not complete. No unverified alerts were issued.'},503);}
 finally{if(locked)try{await redis('EVAL',"if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",1,lock,owner);}catch{}}
}
