import { mascotForTeam } from '../../../lib/mascot-registry';
import { NextResponse } from 'next/server';
import { loadTeamDetail, validTeamId, applyTeamContext } from '../../../lib/team-detail';
import { loadLiveFeed } from '../../../lib/live-feed';
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!validTeamId(id))return NextResponse.json({error:'Invalid team identifier'},{status:400});
 const [team,feed]=await Promise.allSettled([loadTeamDetail(id),loadLiveFeed().then(r=>r.ok?r.json():null)]);
 if(team.status==='rejected')return NextResponse.json({error:'Team information is unavailable. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const data=applyTeamContext(team.value,feed.status==='fulfilled'?feed.value:null);
 data.mascot=mascotForTeam(data.id,data.name);
 return NextResponse.json(data,{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=60'}});
}
