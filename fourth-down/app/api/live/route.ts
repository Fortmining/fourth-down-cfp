import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const BASE='https://site.api.espn.com/apis/site/v2/sports/football/college-football';
async function get(path:string){const r=await fetch(`${BASE}/${path}`,{next:{revalidate:60},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`Provider ${r.status}`);return r.json()}
export async function GET(){try{
 const [scores,rankings]=await Promise.allSettled([get('scoreboard?groups=80&limit=150'),get('rankings')]);
 if(scores.status==='rejected')throw scores.reason;
 const s=scores.value; const games=(s.events||[]).map((e:any)=>{const c=e.competitions?.[0];return {id:e.id,name:e.name,date:e.date,status:e.status?.type?.name,detail:e.status?.type?.shortDetail,teams:(c?.competitors||[]).map((t:any)=>({id:t.team?.id,name:t.team?.displayName,abbr:t.team?.abbreviation,logo:t.team?.logo,score:t.score,homeAway:t.homeAway,winner:t.winner,rank:t.curatedRank?.current}))}});
 const polls=rankings.status==='fulfilled'?(rankings.value.rankings||[]):[];
 const selected=polls.find((p:any)=>/playoff/i.test(p.name||''))||polls.find((p:any)=>/associated press|ap top/i.test(p.name||''))||polls[0];
 const ranked=(selected?.ranks||[]).map((r:any)=>({rank:r.current,teamId:String(r.team?.id||''),name:r.team?.displayName||r.team?.name,logo:r.team?.logos?.[0]?.href,record:r.record||''}));
 return NextResponse.json({updatedAt:new Date().toISOString(),week:s.week?.number||null,rankingSource:selected?.name||null,rankings:ranked,games,provider:'ESPN public endpoints (unofficial; subject to change)'},{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=120'}})
 }catch(e){return NextResponse.json({error:'Live provider unavailable. Retry shortly.',details:String(e)},{status:503})}}
