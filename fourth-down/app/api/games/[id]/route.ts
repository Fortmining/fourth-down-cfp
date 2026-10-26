import {NextResponse} from 'next/server';
import {espnTeamSource,normalizeTeamGame,validTeamId} from '../../../lib/team-detail';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!validTeamId(id))return NextResponse.json({error:'Invalid game identifier'},{status:400});
 try{
  const raw=await espnTeamSource(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${id}`,60);
  const header=raw.header;
  if(String(header?.id)!==id||header.season?.year!==2026)throw Error('Unverified game');
  const c=header.competitions?.[0];const game=normalizeTeamGame({...header,date:c?.date});
  if(!game)throw Error('Game unavailable');
  return NextResponse.json({game,observedAt:new Date().toISOString()},{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=60'}});
 }catch{return NextResponse.json({error:'Game details unavailable. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
