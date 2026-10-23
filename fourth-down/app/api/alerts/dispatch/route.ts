import { NextResponse } from 'next/server';
import { timingSafeEqual,randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { GET as liveFeed } from '../../live/route';
import { alertFeedGate,deriveAlertEvents,selectedEvent,hasAlerts,remainingFollows,type AlertFeed,type ConfirmedDevelopment } from '../../../lib/alerts';
import { appendDeliveryAudit,appendKickoffAudit,appendSchedulerAudit,loadSubscription,pushConfigured,redis,SUBS,tokenHash,type SavedSubscription } from '../../../lib/push-store';
import {kickoffFeedObservations,kickoffObservations,notificationEligibility} from '../../../lib/kickoff-diagnostics';
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
 const startedAt=Date.now(),runId=owner.slice(0,12);let stage='acquire-lock',auditHealthy=true;
 const schedulerAudit=async(entry:Record<string,unknown>)=>{if(!await appendSchedulerAudit({runId,startedAt,...entry}))auditHealthy=false;};
 const deliveryAudit=async(id:string,entry:Record<string,unknown>)=>{const ok=await appendDeliveryAudit(id,entry);if(!ok)auditHealthy=false;return ok;};
 try {
  locked=!!await redis('SET',lock,owner,'NX','EX',120);if(!locked){await schedulerAudit({kind:'run-skipped',reason:'dispatch-lock-held'});return json({skipped:'Already running'});}
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
  stage='background-tests';const backgroundTests=await deliverBackgroundTests();
  stage='fetch-feed';
  const response=await liveFeed();if(!response.ok)throw Error('Feed unavailable');
  const feed=await response.json() as AlertFeed;
  const previous=await redis('GET','fd:v05:baseline');
  const prior=previous?JSON.parse(previous) as AlertFeed:null;const observedAt=Date.now();
  const precedingCheck=await redis('GET','fd:v05:last-check');
  const context={previousFeedAt:prior?.updatedAt??null,currentFeedAt:feed.updatedAt,baselineAgeMs:prior?observedAt-Date.parse(prior.updatedAt):null,currentFeedAgeMs:observedAt-Date.parse(feed.updatedAt),pollGapMs:precedingCheck?observedAt-Date.parse(JSON.parse(precedingCheck).at):null,feedGate:alertFeedGate(prior,feed,observedAt),warnings:feed.warnings??[],scoreboardAvailable:feed.scoreboardAvailable??null,scoreboardDate:feed.scoreboardDate??null};
  const events=deriveAlertEvents(prior,feed,developments as ConfirmedDevelopment[],observedAt);
  stage='record-feed';await schedulerAudit({kind:'feed-observed',...context,currentGameCount:feed.games.length,previousGameCount:prior?.games.length??0,games:kickoffFeedObservations(prior,feed,observedAt),eventIds:events.map(e=>e.id)});
  if(previous&&Date.now()-Date.parse(JSON.parse(previous).updatedAt)>300_000)await deliveryAudit('_scheduler',{kind:'baseline-gap',previousAt:JSON.parse(previous).updatedAt,currentAt:feed.updatedAt});
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
  let sent=0,failed=0;
  // Bounded scan; monitor multiple invocations for larger audiences. All keys
  // share a server-side claim per event/subscription, so overlapping scans dedupe.
  stage='deliver-events';let cursor='0';let scanned=0;
  do {
   const [next,items]=await redis('HSCAN',SUBS,cursor,'COUNT',100);cursor=next;
   for(let i=0;i<items.length;i+=2){
    const record=JSON.parse(items[i+1]) as SavedSubscription;scanned++;
    for(const observation of kickoffObservations(prior,feed,record,observedAt)){if(!await appendKickoffAudit(record.id,observation.gameId,{kind:'kickoff-observed',runId,...context,...observation}))auditHealthy=false;}
    for(const event of events){
     // Re-read immediately before delivery so settings/unsubscribe take effect.
     const current=await loadSubscription(record.id);if(!current)continue;
     const eligibility=notificationEligibility(event,current);const types=eligibility.types;
     if(!types.length||!selectedEvent({...event,types},current.preferences)){await deliveryAudit(current.id,{kind:'event-filtered',eventId:event.id,runId,eventObservedAt:event.observedAt,eligibility,settingsSavedAt:current.updatedAt,following:current.preferences.following,typeSince:current.typeSince});continue;}
     const claim=`fd:v05:sent:${record.id}:${event.id}`;
     if(!await redis('SET',claim,'claimed','NX','EX',60*60*24*400)){await redis('INCR','fd:v05:duplicates-suppressed');await deliveryAudit(current.id,{kind:'duplicate-suppressed',runId,eventId:event.id});continue;}
     let deliveryStage='receipt-storage';
     try {
      const receipt=randomBytes(32).toString('hex');
      await redis('SET',`fd:v05:receipt:${tokenHash(receipt)}`,JSON.stringify({id:current.id,kind:'event',eventId:event.id,types}),'EX',300);
      deliveryStage='provider-send';
      await webpush.sendNotification(current.subscription,JSON.stringify({...event,types,receipt}),{TTL:300,urgency:'normal',timeout:5000});sent++;deliveryStage='acceptance-storage';
      await deliveryAudit(current.id,{kind:'provider-accepted',runId,settingsSavedAt:current.updatedAt,eligibility,eventId:event.id,types,eventObservedAt:event.observedAt,following:current.preferences.following});
      for(const type of types)await redis('HSET','fd:v05:accepted-types',type,JSON.stringify({eventId:event.id,at:new Date().toISOString()}));
     }catch(error){
      failed++;
      const status=(error as {statusCode?:number}).statusCode;
      await deliveryAudit(current.id,{kind:'delivery-failed',stage:deliveryStage,runId,eventId:event.id,status:status??null});
      if(status===404||status===410){await redis('HDEL',SUBS,record.id);break;}
      // Keep claim after an ambiguous timeout: favor no duplicates over retrying
      // a notification that a provider may already have accepted.
     }
    }
    const latest=await loadSubscription(record.id);
    if(latest?.preferences.following){
     const items=remainingFollows(latest.preferences,feed.games);
     if(items.length!==latest.preferences.following.items.length){
      const updated={...latest,preferences:{...latest.preferences,following:{...latest.preferences.following,items}}};
      // Compare-and-set: cleanup must never overwrite a simultaneous unfollow,
      // preference update, or deleted subscription.
      const archived=await deliveryAudit(record.id,{kind:'follow-cleanup-snapshot',previousFollowing:latest.preferences.following,following:updated.preferences.following});
      if(!archived)continue; // Keep the server record when its history cannot be retained.
      const changed=await redis('EVAL',"if redis.call('hget',KEYS[1],ARGV[1]) == ARGV[2] then return redis.call('hset',KEYS[1],ARGV[1],ARGV[3]) else return 0 end",1,SUBS,record.id,JSON.stringify(latest),JSON.stringify(updated));
      if(changed)await deliveryAudit(record.id,{kind:'follows-ended',reason:'confirmed-final-or-expired',previousFollowing:latest.preferences.following,following:updated.preferences.following});
     }
    }
   }
   if(scanned>1000)throw Error('Audience needs a dedicated delivery queue');
  }while(cursor!=='0');
  stage='save-baseline';
  await redis('SET','fd:v05:baseline',JSON.stringify(feed),'EX',60*60*24*14);
  await redis('SET','fd:v05:heartbeat',String(Date.now()),'EX',420);
  await schedulerAudit({kind:'run-completed',...context,sent,failed,events:events.length,scanned,durationMs:Date.now()-startedAt});
  await redis('SET','fd:v05:last-check',JSON.stringify({at:new Date().toISOString(),runId,sent,failed,backgroundTests,events:events.length,diagnosticsHealthy:auditHealthy}),'EX',86400);
  return json({sent,failed,backgroundTests,events:events.length,baseline:!previous},failed||backgroundTests.failed?502:200);
 }catch{await schedulerAudit({kind:'run-failed',stage,durationMs:Date.now()-startedAt});return json({error:'Background check did not complete. No unverified alerts were issued.'},503);}
 finally{if(locked)try{await redis('EVAL',"if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",1,lock,owner);}catch{}}
}

// Explicitly requested device tests use the same scheduled invocation and push
// transport, but never enter the real scores, rankings, or news event stream.
async function deliverBackgroundTests() {
 let cursor='0',scanned=0,sent=0,failed=0;
 do {
  const [next,items]=await redis('HSCAN','fd:v05:background-tests',cursor,'COUNT',100);cursor=next;
  for(let i=0;i<items.length;i+=2){
   if(++scanned>1000)throw Error('Too many pending tests');
   const id=items[i];const job=JSON.parse(items[i+1]);const now=Date.now();
   if(job.dueAt>now)continue;
   if(!await redis('HDEL','fd:v05:background-tests',id))continue;
   if(job.expiresAt<now)continue;
   const sub=await loadSubscription(id);if(!sub||!hasAlerts(sub.preferences))continue;
   if(!await redis('SET',`fd:v05:sent:${id}:${job.eventId}`,'claimed','NX','EX',86400))continue;
   await redis('SET',`fd:v05:receipt:${tokenHash(job.receipt)}`,JSON.stringify({id,kind:'background'}),'EX',300);
   try{
    await webpush.sendNotification(sub.subscription,JSON.stringify({id:job.eventId,test:true,types:[],teamIds:[],title:'Fourth Down · Background test',body:'The scheduled check sent this test. This is not a game or breaking-news alert.',url:'/#alerts',receipt:job.receipt}),{TTL:300,urgency:'normal',timeout:5000});sent++;
   }catch(error){
    if([404,410].includes((error as {statusCode:number}).statusCode))await redis('HDEL',SUBS,id);
    // A failed device test must not interrupt real game/news processing.
    // Do not retry an ambiguous response and risk duplicate tests.
    failed++;
   }
  }
 }while(cursor!=='0');
 return {sent,failed};
}
