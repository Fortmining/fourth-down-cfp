import {NextResponse} from 'next/server';
import {loadSubscription,sameToken,redis} from '../../../lib/push-store';
import type {HistoryEntry} from '../../../lib/notification-history';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin rejected'},403);
 try{
  const raw=await request.text();if(raw.length>2000)return reply({error:'Request too large'},413);const {id,token,action,eventId}=JSON.parse(raw);
  if(typeof id!=='string'||!/^\w{64}$/.test(id)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return reply({error:'Device controls required'},400);
  const saved=await loadSubscription(id);if(!saved||!sameToken(token,saved.tokenHash))return reply({error:'Device controls unavailable'},403);
  const key=`fd:v08:inbox:${id}`;
  if(action==='clear'){await redis('DEL',key);return reply({ok:true});}
  if(!['list','dismiss'].includes(action))return reply({error:'Invalid action'},400);
  const rawEntries:string[]=await redis('LRANGE',key,0,99)||[];
  if(action==='dismiss'){
   if(typeof eventId!=='string'||eventId.length>200)return reply({error:'Invalid event'},400);
   for(const encoded of rawEntries)if(JSON.parse(encoded).id===eventId)await redis('LREM',key,0,encoded);
   return reply({ok:true});
  }
  const seen=new Set<string>();const entries=rawEntries.flatMap(encoded=>{try{const e=JSON.parse(encoded) as HistoryEntry;const u=new URL(e.url,new URL(request.url).origin);if((u.origin!==new URL(request.url).origin&&!(u.protocol==='https:'&&['collegefootballplayoff.com','apnews.com','afca.com','espn.com','www.espn.com','ncaa.com'].includes(u.hostname.replace(/^www\./,''))))||typeof e.id!=='string'||typeof e.title!=='string'||typeof e.body!=='string'||!Array.isArray(e.types)||!Number.isFinite(e.generatedAt)||e.generatedAt<=0||e.generatedAt>Date.now()+30000||!Number.isFinite(e.recordedAt)||e.recordedAt<Date.now()-30*86400000||seen.has(e.id))return [];seen.add(e.id);return [{...e,url:u.origin===new URL(request.url).origin?u.pathname+u.search+u.hash:u.href}];}catch{return [];}});
  return reply({ok:true,entries,retention:'Most recent 100 generated alerts, up to 30 days. Generation is not proof of device display.'});
 }catch{return reply({error:'History is unavailable. Retry when connected.'},503);}
}
