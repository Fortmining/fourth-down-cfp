import {NextResponse} from 'next/server';
import {cronAuthorized,redis,SUBS,type SavedSubscription} from '../../../lib/push-store';
import type {AlertFeed} from '../../../lib/alerts';
export const dynamic='force-dynamic';
const iso=(value:unknown)=>Number.isFinite(Number(value))&&Number(value)>0?new Date(Number(value)).toISOString():null;
export async function GET(request:Request){
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!cronAuthorized(request))return json({error:'Not authorized'},401);
 const gameId=new URL(request.url).searchParams.get('gameId');
 if(!gameId||!/^\d{1,12}$/.test(gameId))return json({error:'A numeric gameId is required'},400);
 try{
  const devices=[];let cursor='0',scanned=0;
  do{
   const [next,entries]=await redis('HSCAN',SUBS,cursor,'COUNT',100);cursor=next;
   for(let i=0;i<entries.length;i+=2){
    if(++scanned>1000)throw Error('Audience limit');
    const s=JSON.parse(entries[i+1]) as SavedSubscription;
    const [kickoff,final,delivery]=await Promise.all([
     redis('GET',`fd:v05:sent:${s.id}:game:${gameId}:kickoff`),
     redis('GET',`fd:v05:sent:${s.id}:game:${gameId}:final`),
     redis('GET',`fd:v05:delivery:${s.id}`)
    ]);
    devices.push({deviceAlias:s.id.slice(0,12),pushService:new URL(s.subscription.endpoint).hostname,
     settingsSavedAt:iso(s.updatedAt),categoryActiveSince:Object.fromEntries(Object.entries(s.typeSince).map(([k,v])=>[k,iso(v)])),
     preferences:s.preferences,claims:{kickoff:!!kickoff,final:!!final},lastBrowserDisplayReceiptAt:iso(delivery)});
   }
  }while(cursor!=='0');
  const baseline=await redis('GET','fd:v05:baseline');const feed=baseline?JSON.parse(baseline) as AlertFeed:null;
  return json({observedAt:new Date().toISOString(),gameId,baselineAt:feed?.updatedAt??null,game:feed?.games.find(g=>g.id===gameId)??null,devices,
   historicalFollowAuditAvailable:false,limitations:['Completed one-game follows were removed by v0.6 without retaining their creation timestamps.','An event claim can include an ambiguous push-provider failure; it is not display proof.','Browser display receipts do not prove an OS banner was seen.']});
 }catch{return json({error:'Production diagnostics unavailable'},503);}
}
