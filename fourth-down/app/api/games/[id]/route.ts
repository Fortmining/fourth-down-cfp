import {unstable_cache} from 'next/cache';
import {watchDestination} from '../../../lib/game-extras';
import {normalizeGameCenter} from '../../../lib/game-center';
import {NextResponse} from 'next/server';
import {espnTeamSource,normalizeTeamGame,validTeamId} from '../../../lib/team-detail';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!validTeamId(id))return NextResponse.json({error:'Invalid game identifier'},{status:400});
 try{
  const url=`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${id}`;
  const recovery=new URL(_request.url).searchParams.get('recover')==='1';
  const verified=recovery?await unstable_cache(async()=>{
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(6000)});
   if(!response.ok)throw Error('Source recovery unavailable');return {raw:await response.json(),sourceCheckedAt:new Date().toISOString()};
  },['gamecast-recovery-v2',id,String(Math.floor(Date.now()/60000)%2)],{revalidate:30})():null;
  if(verified&&Date.now()-Date.parse(verified.sourceCheckedAt)>90000)throw Error('Recovery cache is revalidating');
  const raw=verified?.raw||await espnTeamSource(url,15);
  const header=raw.header;
  if(String(header?.id)!==id||header.season?.year!==2026)throw Error('Unverified game');
  const c=header.competitions?.[0];const game=normalizeTeamGame({...header,date:c?.date});
  if(!game)throw Error('Game unavailable');
  const center=normalizeGameCenter(raw);const period=Number.isInteger(c?.status?.period)?c.status.period:center.drives.flatMap(d=>d.plays).at(-1)?.period??null;
  return NextResponse.json({sourceCheckedAt:verified?.sourceCheckedAt||null,progress:{period},game,watch:watchDestination(Array.isArray(header.links)?header.links:[],game.broadcast??''),center,observedAt:new Date().toISOString()},{headers:{'Cache-Control':recovery?'public, s-maxage=10, stale-while-revalidate=5':game.status==='post'?'public, s-maxage=300, stale-while-revalidate=60':'public, s-maxage=10, stale-while-revalidate=5'}});
 }catch{return NextResponse.json({error:'Game details unavailable. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
