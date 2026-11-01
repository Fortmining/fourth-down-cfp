import {NextResponse} from 'next/server';
import {newsReviewEnabled} from '../../../../../lib/news-review-mode';
export async function GET(_request:Request,{params}:{params:Promise<{resource:string;id?:string[]}>}){
  if(!newsReviewEnabled())return NextResponse.json({error:'Not available'}, {status:404});
  const {default:data}=await import('../../../../../data/news-review.json');
  const {resource,id}=await params;
  let result:unknown;
  if(resource==='live')result=data.feed;
  else if(resource==='resumes')result=data.resumes;
  else if(resource==='team'&&id?.[0]===data.team.id)result=data.team;
  else if(resource==='team'&&['349','2426','235'].includes(id?.[0]||'')){
    const teamId=id![0],names:Record<string,string>={'349':'Army Black Knights','2426':'Navy Midshipmen','235':'Memphis Tigers'};
    result={id:teamId,name:names[teamId],nickname:null,mascot:null,conference:'American Conference',record:data.feed.currentRecords[teamId as keyof typeof data.feed.currentRecords]||null,games:data.feed.games.filter(g=>g.teams.some(t=>t.id===teamId)),scheduleAvailable:false,polls:data.team.polls,stats:[],warnings:['Protected review: partial October 28 capture; full schedule, statistics and standings are not included.'],observedAt:data.feed.updatedAt,sources:[]};
  }
  else if(resource==='game'){
    const game=data.feed.games.find(g=>g.id===id?.[0]);
    if(game)result={game,observedAt:data.feed.updatedAt};
  }else if(resource==='alerts')result={available:false,publicKey:null,notificationsSupported:false,items:[],message:'Protected review: notifications disabled'};
  return result?NextResponse.json(result,{headers:{'Cache-Control':'private, max-age=60'}}):NextResponse.json({error:'Not included in this isolated review'},{status:404});
}
export async function POST(){return NextResponse.json({error:'Review writes and notifications are disabled'},{status:403});}
export const PUT=POST;
export const DELETE=POST;
export const PATCH=POST;
