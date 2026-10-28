import {recoverRankings} from '../../../lib/ranking-recovery';
import {derivePulse,pulseBudgetAllows,nationalSelected,type PulseBudget} from '../../../lib/pulse';
import {recordNotification} from '../../../lib/notification-history';
import {outlookSnapshot,compareOutlooks} from '../../../lib/outlook-snapshots';
import { NextResponse } from 'next/server';
import { timingSafeEqual,randomBytes } from 'node:crypto';
import webpush from 'web-push';
import {loadLiveFeed} from '../../../lib/live-feed';
import { alertFeedGate,deriveAlertEvents,selectedEvent,hasAlerts,remainingFollows,type AlertFeed,type ConfirmedDevelopment } from '../../../lib/alerts';
import { appendDeliveryAudit,appendKickoffAudit,appendSchedulerAudit,loadSubscription,pushConfigured,redis,SUBS,tokenHash,type SavedSubscription } from '../../../lib/push-store';
import {kickoffFeedObservations,kickoffObservations,notificationEligibility} from '../../../lib/kickoff-diagnostics';
import {deriveGameAlerts,gameAlertRate} from '../../../lib/game-alerts';
import {recoverKickoffs} from '../../../lib/kickoff-recovery';
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
  const resumeCapture=process.env.FOURTH_DOWN_RESUME_RELEASE==='confirmed-2026-v1'?{} as {batch?:import('../../../lib/playoff/current-resume-producer').CapturedResumeBatch}:undefined;
  const response=await loadLiveFeed({forAlerts:true,...(resumeCapture?{resumeCapture}:{})});if(!response.ok)throw Error('Feed unavailable');
  const feed=await response.json() as AlertFeed;
  const previous=await redis('GET','fd:v05:baseline');
  const prior=previous?JSON.parse(previous) as AlertFeed:null;const observedAt=Date.now();
  const precedingCheck=await redis('GET','fd:v05:last-check');
  const context={sourceFetch:feed.sourceFetch??null,previousFeedAt:prior?.updatedAt??null,currentFeedAt:feed.updatedAt,baselineAgeMs:prior?observedAt-Date.parse(prior.updatedAt):null,currentFeedAgeMs:observedAt-Date.parse(feed.updatedAt),pollGapMs:precedingCheck?observedAt-Date.parse(JSON.parse(precedingCheck).at):null,feedGate:alertFeedGate(prior,feed,observedAt),warnings:feed.warnings??[],scoreboardAvailable:feed.scoreboardAvailable??null,scoreboardDate:feed.scoreboardDate??null};
  stage='kickoff-recovery';
  let recovery:ReturnType<typeof recoverKickoffs>|null=null;
  try{
   const stored=await redis('GET','fd:v062:kickoff-state');
   recovery=recoverKickoffs(prior,feed,stored?JSON.parse(stored):null,observedAt);
   await redis('SET','fd:v062:kickoff-state',JSON.stringify(recovery.memory),'EX',2*86400);
  }catch{auditHealthy=false;await schedulerAudit({kind:'kickoff-recovery-unavailable'});}
  stage='game-alerts';let gameAlerts:ReturnType<typeof deriveGameAlerts>|null=null;
  try{const stored=await redis('GET','fd:v07:game-state');gameAlerts=deriveGameAlerts(prior,feed,stored?JSON.parse(stored):null,observedAt);await redis('SET','fd:v07:game-state',JSON.stringify(gameAlerts.state),'EX',2*86400);}catch{auditHealthy=false;await schedulerAudit({kind:'game-alert-state-unavailable'});}
  // Versioned, complete poll-position snapshots are groundwork, never CFP predictions.
  try{
   const snapshot=outlookSnapshot(feed,observedAt);if(snapshot){
    const fingerprint=JSON.stringify([snapshot.modelVersion,snapshot.season,snapshot.edition,snapshot.teams]);
    const rawCandidate=await redis('GET','fd:v08:outlook-candidate'),candidate=rawCandidate?JSON.parse(rawCandidate):null;
    if(candidate?.fingerprint===fingerprint&&candidate.at<observedAt&&observedAt-candidate.at<=600000){
     const rawStable=await redis('GET','fd:v08:outlook'),stable=rawStable?JSON.parse(rawStable):null;
     if(stable?.snapshot.id===snapshot.id&&stable.fingerprint&&stable.fingerprint!==fingerprint){await schedulerAudit({kind:'outlook-same-edition-correction-held'});}else{
     const comparison=stable?.snapshot.id===snapshot.id?stable.comparison:compareOutlooks(stable?.snapshot??null,snapshot);
     await redis('SET','fd:v08:outlook',JSON.stringify({snapshot,comparison,fingerprint}),'EX',9*86400);
     if(stable?.snapshot.id!==snapshot.id){await redis('LPUSH','fd:v08:outlook-history',JSON.stringify({snapshot,comparison,fingerprint}));await redis('LTRIM','fd:v08:outlook-history',0,9);await redis('EXPIRE','fd:v08:outlook-history',30*86400);}
     }
    }
    await redis('SET','fd:v08:outlook-candidate',JSON.stringify({fingerprint,at:observedAt}),'EX',660);
   }
  }catch{auditHealthy=false;await schedulerAudit({kind:'outlook-snapshot-unavailable'});}
  let rankingEvents:import('../../../lib/alerts').AlertEvent[]=[];
  try{const raw=await redis('GET','fd:v08:ranking-state');const ranked=recoverRankings(prior,feed,raw?JSON.parse(raw):null,observedAt);await redis('SET','fd:v08:ranking-state',JSON.stringify(ranked.state),'EX',14*86400);rankingEvents=ranked.events;}catch{auditHealthy=false;await schedulerAudit({kind:'ranking-recovery-unavailable'});rankingEvents=deriveAlertEvents(prior,feed,[],observedAt).filter(e=>e.types.some(t=>['ap','coaches','cfp'].includes(t))&&prior?.polls.some(p=>p.id===e.types[0]&&p.status==='available'));}
  let pulseEvents:import('../../../lib/alerts').AlertEvent[]=[];
  try{pulseEvents=derivePulse(feed,gameAlerts?.state??null,gameAlerts?.events||[],observedAt);}catch{auditHealthy=false;await schedulerAudit({kind:'pulse-detection-unavailable'});}
  const merged=new Map<string,import('../../../lib/alerts').AlertEvent>();
  for(const e of [...deriveAlertEvents(prior,feed,developments as ConfirmedDevelopment[],observedAt).filter(e=>!e.types.some(t=>['kickoff','ap','coaches','cfp'].includes(t))),...(recovery?.events||[]),...(gameAlerts?.events||[]),...pulseEvents,...rankingEvents]){
   const old=merged.get(e.id);const combined=old?[...new Set([...old.types,...e.types])]:e.types;
   merged.set(e.id,!old?e:e.types.some(t=>t.startsWith('pulse'))?{...old,discovery:e.discovery??old.discovery,pulseContent:{title:e.title,body:e.body,url:e.url,expiresAt:e.expiresAt},types:combined}:{...old,...e,types:combined});
  }
  const events=[...merged.values()].sort((a,b)=>Number(b.types.includes('final')||b.types.includes('confirmedUpset'))-Number(a.types.includes('final')||a.types.includes('confirmedUpset')));
  stage='record-feed';await schedulerAudit({kind:'feed-observed',gameAlertGate:gameAlerts?.gate??'storage-unavailable',kickoffRecoveryGate:recovery?.gate??'storage-unavailable',kickoffRecovery:recovery?.decisions??{},...context,currentGameCount:feed.games.length,previousGameCount:prior?.games.length??0,games:kickoffFeedObservations(prior,feed,observedAt),eventIds:events.map(e=>e.id)});
  if(previous&&Date.now()-Date.parse(JSON.parse(previous).updatedAt)>300_000)await deliveryAudit('_scheduler',{kind:'baseline-gap',previousAt:JSON.parse(previous).updatedAt,currentAt:feed.updatedAt});
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
  let sent=0,failed=0;
  // Bounded scan; monitor multiple invocations for larger audiences. All keys
  // share a server-side claim per event/subscription, so overlapping scans dedupe.
  stage='deliver-events';let cursor='0';let scanned=0;
  do {
   const [next,items]=await redis('HSCAN',SUBS,cursor,'COUNT',100);cursor=next;
   for(let i=0;i<items.length;i+=2){
    const record=JSON.parse(items[i+1]) as SavedSubscription;scanned++;const deliveredGames=new Set<string>();
    for(const observation of kickoffObservations(prior,feed,record,observedAt)){if(!await appendKickoffAudit(record.id,observation.gameId,{kind:'kickoff-observed',runId,...context,...observation,recovery:recovery?.decisions[observation.gameId]??null}))auditHealthy=false;}
    for(const event of events){
     // Re-read immediately before delivery so settings/unsubscribe take effect.
     const current=await loadSubscription(record.id);if(!current)continue;
     if(event.types.every(t=>t.startsWith('pulse'))&&!current.preferences.pulse?.enabled)continue;
     const eligibility=notificationEligibility(event,current);let types=eligibility.types;
     if(!types.length||!selectedEvent({...event,types},current.preferences)){await deliveryAudit(current.id,{kind:'event-filtered',eventId:event.id,runId,favoriteTeamIds:current.preferences.favorites.filter(t=>event.teamIds.includes(t.id)).map(t=>t.id),eventObservedAt:event.observedAt,eligibility,settingsSavedAt:current.updatedAt,gameAlerts:current.preferences.gameAlerts,gameAccess:current.gameAccess,kickoffAccess:current.kickoffAccess,following:current.preferences.following,typeSince:current.typeSince});continue;}
     // Discovery budgets never suppress a separately opted-in favorite/follow alert.
     const national=nationalSelected({...event,types},current.preferences);
     const legacy=selectedEvent({...event,types}, {...current.preferences,pulse:undefined});
     const pulseBudgetKey=`fd:v08:pulse-budget:${current.id}`;let pulseBudget:PulseBudget=[];
     if(national&&!legacy){
      try{const raw=await redis('GET',pulseBudgetKey);pulseBudget=raw?JSON.parse(raw):[];if(!current.preferences.pulse||!pulseBudgetAllows(types,/^game:(\d+):/.exec(event.id)?.[1],current.preferences.pulse,pulseBudget,Date.now())){await deliveryAudit(current.id,{kind:'pulse-rate-limited',runId,eventId:event.id});continue;}}
      catch{await deliveryAudit(current.id,{kind:'pulse-budget-unavailable',runId,eventId:event.id});continue;}
     }
     const optionalLive=types.some(t=>['halftime','close','upsetWatch','scoring'].includes(t));
     const gameKey=/^game:(\d+):/.exec(event.id)?.[1];const recentKey=`fd:v07:last-live:${current.id}:${gameKey}`;
     const budgetKey=`fd:v07:live-budget:${current.id}`;
     if(types.includes('scoring')&&gameKey&&deliveredGames.has(gameKey)){await deliveryAudit(current.id,{kind:'coalesced-with-game-alert',runId,eventId:event.id});continue;}
     if(optionalLive){
      const last=Number(await redis('GET',recentKey)||0),rawBudget=await redis('GET',budgetKey);const budget=(rawBudget?JSON.parse(rawBudget):[]) as number[];
      if((gameAlertRate({...event,types})>0&&Date.now()-last<gameAlertRate({...event,types}))||budget.filter(at=>at>Date.now()-900000).length>=6){await deliveryAudit(current.id,{kind:'rate-limited',runId,eventId:event.id,types});continue;}
     }
     const effective=national&&!legacy&&event.pulseContent?{...event,...event.pulseContent}:event;
     const ttl=effective.expiresAt===undefined?300:Math.min(300,Math.floor((effective.expiresAt-Date.now())/1000));if(ttl<=0)continue;
     const claim=`fd:v05:sent:${record.id}:${event.id}`;
     if(!await redis('SET',claim,'claimed','NX','EX',60*60*24*400)){await redis('INCR','fd:v05:duplicates-suppressed');await deliveryAudit(current.id,{kind:'duplicate-suppressed',runId,eventId:event.id});continue;}
     const urgency=types.includes('kickoff')?'high':'normal';
     let deliveryStage='receipt-storage';
     try {
      const receipt=randomBytes(32).toString('hex');
      await redis('SET',`fd:v05:receipt:${tokenHash(receipt)}`,JSON.stringify({id:current.id,kind:'event',eventId:event.id,types}),'EX',300);
      if(optionalLive){await redis('SET',recentKey,String(Date.now()),'EX',3600);const priorBudget=await redis('GET',budgetKey);const times=(priorBudget?JSON.parse(priorBudget):[]) as number[];await redis('SET',budgetKey,JSON.stringify([...times.filter(at=>at>Date.now()-900000),Date.now()]),'EX',1800);}
      if(national&&!legacy)await redis('SET',pulseBudgetKey,JSON.stringify([...pulseBudget.filter(b=>b.at>Date.now()-86400000),{at:Date.now(),types,gameId:gameKey}].slice(-100)),'EX',2*86400);
      deliveryStage='provider-send';
      const title=types.includes('pulseFinal')?'Confirmed Major Upset':types.includes('pulseUpset')?'Upset Watch':types.includes('pulseClose')?'Close Game Discovery':types.includes('pulseInteresting')?'Interesting Live Game':types.includes('confirmedUpset')?'Confirmed Upset · Final':types.includes('upsetWatch')?'Upset Watch':types.includes('close')?'Close game':types.includes('halftime')?'Halftime score':types.includes('scoring')?'Scoring update':types.includes('final')&&!types.includes('upset')?'Final score':event.title;
      const payload={...effective,title,types,receipt};
      try{await recordNotification(current.id,payload);}catch{auditHealthy=false;await deliveryAudit(current.id,{kind:'history-unavailable',eventId:event.id,runId});}
      await deliveryAudit(current.id,{kind:'provider-send-attempt',scoreboardSource:feed.sourceFetch?.scoreboard??null,eventId:event.id,runId,types,ttl,urgency,expiresAt:effective.expiresAt??null,favoriteTeamIds:current.preferences.favorites.filter(t=>event.teamIds.includes(t.id)).map(t=>t.id),myTeams:current.preferences.myTeams,favoriteChoices:current.preferences.gameAlerts?.favorites});
      await webpush.sendNotification(current.subscription,JSON.stringify(payload),{TTL:ttl,urgency,timeout:5000});sent++;if(gameKey)deliveredGames.add(gameKey);deliveryStage='acceptance-storage';
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
  let resumeSync:unknown;
  if(resumeCapture){try{const {publishReleasedResumes}=await import('../../../lib/playoff/resume-production');resumeSync=await publishReleasedResumes(resumeCapture.batch,precedingCheck?JSON.parse(precedingCheck).resumeSync:undefined,startedAt);}catch{resumeSync={status:'failed',at:Date.now()};}}
  await redis('SET','fd:v05:last-check',JSON.stringify({at:new Date().toISOString(),runId,sent,failed,backgroundTests,events:events.length,diagnosticsHealthy:auditHealthy,...(resumeCapture?{resumeSync}:{})}),'EX',86400);
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
