import { NextResponse } from 'next/server';
import { appendDeliveryAudit,redis,tokenHash } from '../../../lib/push-store';
export async function POST(request:Request) {
 const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origin rejected'},403);
 try{
  const text=await request.text();if(text.length>400)return json({error:'Invalid receipt'},400);
  const {receipt,workerVersion,platform,openClients}=JSON.parse(text);if(typeof receipt!=='string'||!/^[a-f0-9]{64}$/.test(receipt))return json({error:'Invalid receipt'},400);
  const stored=await redis('GETDEL',`fd:v05:receipt:${tokenHash(receipt)}`);if(!stored)return json({error:'Receipt expired'},410);
  let id=stored,kind='immediate',eventId='',types:string[]=[];try{const parsed=JSON.parse(stored);id=parsed.id;kind=parsed.kind;eventId=parsed.eventId;types=parsed.types||[];}catch{}
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))return json({error:'Invalid receipt'},400);
  const deviceEvidence={deviceAlias:id.slice(0,12),workerVersion:typeof workerVersion==='string'&&/^\d+\.\d+\.\d+$/.test(workerVersion)?workerVersion:null,platform:['ios','macos','other','unknown'].includes(platform)?platform:null,openClients:Number.isInteger(openClients)&&openClients>=0&&openClients<=1000?openClients:null};
  await appendDeliveryAudit(id,{kind:'browser-displayed',eventId:kind==='event'?eventId:null,test:kind!=='event',...deviceEvidence});
  if(kind==='event'&&typeof eventId==='string')for(const type of types)if(['pulseUpset','pulseFinal','pulseClose','pulseInteresting','playoffShakeup','bubbleMovement','halftime','close','upsetWatch','confirmedUpset','scoring','kickoff','final','upset','development','ap','coaches','cfp'].includes(type))await redis('HSET','fd:v05:verified-types',type,JSON.stringify({eventId,at:new Date().toISOString(),...deviceEvidence}));
  if(kind==='background')await redis('SET','fd:v05:last-background-delivery',String(Date.now()),'EX',60*60*24*30);
  await redis('SET',`fd:v05:delivery:${id}`,String(Date.now()),'EX',60*60*24*30);
  await redis('SET','fd:v05:last-verified-delivery',String(Date.now()),'EX',60*60*24*30);
  return json({ok:true});
 }catch{return json({error:'Could not record receipt'},503);}
}
