import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {unstable_cache} from 'next/cache';
import {decodeTeamView} from '../../../../lib/cfbd-team-view';
import {readHttpTeam} from '../../../../lib/cfbd-http-reader';
import {isPulseTeam} from '../../../../lib/pulse-teams';

async function readTeam(team:string) {
  const dir=process.env.PULSE_CFBD_VIEWS_DIR;
  let text:string;
  if (dir && !process.env.VERCEL) {
    text=await readFile(join(dir,team+'.json'),'utf8');
  } else {
    if(process.env.PULSE_CFBD_READ!=='approved-v1')return null;
    const base=new URL(process.env.PULSE_CFBD_REDIS_URL||'');
    const token=process.env.PULSE_CFBD_REDIS_READ_TOKEN;
    for(const configured of [process.env.UPSTASH_REDIS_REST_URL,process.env.KV_REST_API_URL]){
      if(configured&&new URL(configured).hostname===base.hostname)return null;
    }
    if(!token||base.protocol!=='https:'||!base.hostname.endsWith('.upstash.io')||base.pathname!=='/'||
       base.port||base.username||base.password||base.search||base.hash)return null;
    const res=await fetch(base,{method:'POST',body:JSON.stringify(['GET','fd:{cfbd-views-v1}:team:'+team]),
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},redirect:'error',
      cache:'no-store',signal:AbortSignal.timeout(4000)});
    if(!res.ok)throw Error('Mirror unavailable');
    const body=await res.json();
    if(body.error)throw Error('Mirror unavailable');
    if(typeof body.result!=='string')return null;
    text=body.result;
  }
  return decodeTeamView(text,team);
}
const cached=unstable_cache(async (team:string)=>{
  try{return await readTeam(team);}catch{return null;}
},['cfbd-team-display-v1'],{revalidate:21600});
export async function GET(_request:Request, {params}:{params:Promise<{team:string}>}) {
  const {team}=await params;
  if(!isPulseTeam(team))return Response.json({available:false},{status:404});
  const result=process.env.PULSE_CFBD_READ==='cloudflare-v1'?await readHttpTeam(team):null;
  const view=result?result.view:await cached(team);
  return Response.json({available:!!view,view,stale:result?.stale??false},{headers:{'Cache-Control':result?.stale?'no-store':view?'public, max-age=300':'no-store'}});
}
