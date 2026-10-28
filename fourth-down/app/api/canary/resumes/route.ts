import {revalidateTag} from 'next/cache';import {nextCachedResumeStore} from '../../../lib/playoff/next-resume-cache';import {buildCanaryResume,canaryEnabled} from '../../../lib/playoff/resume-canary';
export const dynamic='force-dynamic';export const maxDuration=15;
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
 if(!canaryEnabled())return new Response('Not found',{status:404,headers});
 const url=new URL(request.url),stage=url.searchParams.get('stage')??'before';if(!['before','after','unavailable','invalidate'].includes(stage)||[...url.searchParams.keys()].some(k=>k!=='stage'))return new Response('Invalid scenario',{status:400,headers});
 const run=process.env.FOURTH_DOWN_CANARY_RUN!;
 if(stage==='invalidate'){for(const suffix of ['00','01','02'])revalidateTag('resume-display:fd:{resume-private-'+run+suffix+'}:');return Response.json({invalidated:true,redisCommands:0},{headers});}
 const namespace='fd:{resume-private-'+run+({before:'00',after:'01',unavailable:'02'}[stage])+ '}:';
 const store=nextCachedResumeStore({readDisplay:async()=>{console.info(JSON.stringify({event:'resume-canary-source-read',run,stage}));if(stage==='unavailable')throw Error('Controlled unavailable source');return buildCanaryResume(stage as 'before'|'after');},transaction:async()=>{throw Error('Canary display cannot write a shared checkpoint');}},namespace);
 try{const packet=await store.readDisplay!() as Awaited<ReturnType<typeof buildCanaryResume>>;return Response.json({...packet,canary:{...packet.canary,runId:run}},{headers});}catch{return Response.json({status:'unavailable',view:null},{status:503,headers});}
}
