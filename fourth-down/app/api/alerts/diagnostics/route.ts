import {NextResponse} from 'next/server';
import {appendDeliveryAudit,cronAuthorized,redis,loadSubscription,sameToken,SUBS,type SavedSubscription} from '../../../lib/push-store';
import {normalizePreferences,type AlertFeed} from '../../../lib/alerts';
import {sanitizeSyncAttempt} from '../../../lib/kickoff-diagnostics';
export const dynamic='force-dynamic';
const iso=(value:unknown)=>Number.isFinite(Number(value))&&Number(value)>0?new Date(Number(value)).toISOString():null;
export async function GET(request:Request){
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!cronAuthorized(request))return json({error:'Not authorized'},401);
 const gameId=new URL(request.url).searchParams.get('gameId');
 if(!gameId||!/^\d{1,12}$/.test(gameId))return json({error:'A numeric gameId is required'},400);
 const limit=Math.min(2000,Math.max(1,Math.floor(Number(new URL(request.url).searchParams.get('historyLimit'))||100)));
 try{
  const devices=[];let cursor='0',scanned=0;
  do{
   const [next,entries]=await redis('HSCAN',SUBS,cursor,'COUNT',100);cursor=next;
   for(let i=0;i<entries.length;i+=2){
    if(++scanned>1000)throw Error('Audience limit');
    const s=JSON.parse(entries[i+1]) as SavedSubscription;
    const [kickoff,final,delivery,report,history,kickoffHistory,eventHistory]=await Promise.all([
     redis('GET',`fd:v05:sent:${s.id}:game:${gameId}:kickoff`),
     redis('GET',`fd:v05:sent:${s.id}:game:${gameId}:final`),
     redis('GET',`fd:v05:delivery:${s.id}`),redis('GET',`fd:v06:device-report:${s.id}`),redis('LRANGE',`fd:v06:audit:${s.id}`,0,199),redis('LRANGE',`fd:v06:kickoff:${s.id}:${gameId}`,0,limit-1),redis('LRANGE',`fd:v083:game-delivery:${s.id}:${gameId}`,0,299)
    ]);
    devices.push({deviceAlias:s.id.slice(0,12),pushService:new URL(s.subscription.endpoint).hostname,
     settingsSavedAt:iso(s.updatedAt),categoryActiveSince:Object.fromEntries(Object.entries(s.typeSince).map(([k,v])=>[k,iso(v)])),
     preferences:s.preferences,kickoffAccess:s.kickoffAccess??null,gameAccess:s.gameAccess??null,kickoffHistory:(kickoffHistory||[]).map((entry:string)=>JSON.parse(entry)),deviceReport:report?JSON.parse(report):null,audit:(history||[]).slice(0,50).map((entry:string)=>JSON.parse(entry)),eventHistory:[...new Set<string>([...(eventHistory||[]),...(history||[])])].map(entry=>JSON.parse(entry)).filter(entry=>typeof entry.eventId==='string'&&entry.eventId.startsWith(`game:${gameId}:`)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,300),claims:{kickoff:!!kickoff,final:!!final},lastBrowserDisplayReceiptAt:iso(delivery)});
   }
  }while(cursor!=='0');
  const baseline=await redis('GET','fd:v05:baseline');const feed=baseline?JSON.parse(baseline) as AlertFeed:null;
  return json({observedAt:new Date().toISOString(),gameId,baselineAt:feed?.updatedAt??null,game:feed?.games.find(g=>g.id===gameId)??null,devices,
   historicalFollowAuditAvailable:false,schedulerHistory:((await redis('LRANGE','fd:v06:scheduler',0,limit-1))||[]).map((entry:string)=>{const e=JSON.parse(entry);return {...e,games:e.games?.filter((g:{gameId:string})=>g.gameId===gameId)};}),retention:{inactiveKeyTtlDays:30,kickoffEntriesPerDeviceGame:2000,eventEntriesPerDeviceGame:300,schedulerEntries:24000,requestedLimit:limit},limitations:['Completed one-game follows were removed by v0.6 without retaining their creation timestamps.','An event claim can include an ambiguous push-provider failure; it is not display proof.','Browser display receipts do not prove an OS banner was seen.']});
 }catch{return json({error:'Production diagnostics unavailable'},503);}
}

export async function POST(request:Request){
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origin rejected'},403);
 try{
  const text=await request.text();if(text.length>256000)return json({error:'Report too large'},413);
  const d=JSON.parse(text);
  if(typeof d.id!=='string'||!/^[a-f0-9]{64}$/.test(d.id)||typeof d.token!=='string'||!/^[a-f0-9]{64}$/.test(d.token))return json({error:'Invalid device controls'},400);
  const saved=await loadSubscription(d.id);if(!saved||!sameToken(d.token,saved.tokenHash))return json({error:'Device controls unavailable or expired'},403);
  if(d.action==='sync-attempt'){
   const attempt=sanitizeSyncAttempt(d.attempt);if(!attempt)return json({error:'Invalid sync stage'},400);
   const recorded=await appendDeliveryAudit(d.id,{kind:'following-sync',clientAttempt:attempt,serverSettingsSavedAt:saved.updatedAt,serverFollowing:saved.preferences.following});
   return json({ok:recorded},recorded?200:503);
  }
  const workerFollowing=normalizePreferences({following:d.workerFollowing}).following;
  const syncHistory=(Array.isArray(d.syncHistory)?d.syncHistory:[]).slice(-40).map(sanitizeSyncAttempt).filter(Boolean);
  const report={syncHistory,reportedAt:new Date().toISOString(),clientReportedAt:iso(d.clientNow),clockOffsetMs:Number.isFinite(d.clientNow)?Date.now()-d.clientNow:null,
   workerFollowing,localFollowing:normalizePreferences({following:d.localFollowing}).following,
   pendingSettings:d.pendingSettings===true,followingPending:d.followingPending===true,standalone:d.standalone===true,workerPresent:d.workerPresent===true,
   permission:['granted','denied','default','unsupported'].includes(d.permission)?d.permission:null,platform:['ios','macos','other'].includes(d.platform)?d.platform:null};
  await redis('SET',`fd:v06:device-report:${d.id}`,JSON.stringify(report),'EX',60*60*24*30);
  return json({ok:true,deviceAlias:d.id.slice(0,12),workerFollowCount:workerFollowing?.items.length||0});
 }catch{return json({error:'Could not save device report'},503);}
}
