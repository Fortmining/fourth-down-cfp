import fs from 'node:fs';
import {FileResumeStore} from '../../../lib/playoff/file-resume-store.ts';
import type {SharedResumeDisplay} from '../../../lib/playoff/resume-pipeline.ts';
import {ResumePipeline} from '../../../lib/playoff/resume-pipeline.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(process.env.NODE_ENV!=='development'||process.env.FOURTH_DOWN_PRIVATE_RESUME_PREVIEW!=='true')return new Response('Not found',{status:404});
 const root=process.env.FOURTH_DOWN_PRIVATE_RESUME_STORE;
 if(!root)return Response.json({status:'unavailable',view:null},{status:503});
 const pipeline=new ResumePipeline(new FileResumeStore(root),{read:async()=>{throw Error('Display cannot fetch or ingest sources');}});
 let display=await pipeline.display() as Partial<SharedResumeDisplay>;
 if(display.view?.season!==2026)return Response.json({status:'unavailable',view:null},{status:503,headers:{'Cache-Control':'no-store'}});
 const selected=new URL(request.url).searchParams.get('snapshot');
 if(selected){const saved=await pipeline.historyView(selected) as {status:string;view?:SharedResumeDisplay['view']};if(saved.status!=='archived'||saved.view?.season!==2026)return Response.json({status:'unavailable',view:null},{status:503,headers:{'Cache-Control':'no-store'}});display={...display,status:'archived',view:saved.view,checkedAt:saved.view.at};}
 const logos:Record<string,string>={};const captureFile=process.env.FOURTH_DOWN_PRIVATE_RESUME_CAPTURE;
 if(captureFile)try{if(fs.statSync(captureFile).size<=2*1024*1024){const capture=JSON.parse(fs.readFileSync(captureFile,'utf8'));if(capture.scoreboard?.season?.year===2026)for(const game of capture.scoreboard.events??[])for(const competitor of game.competitions?.[0]?.competitors??[]){const team=competitor.team,url=team?.logo||team?.logos?.[0]?.href;if(typeof url==='string'&&/^\d+$/.test(String(team.id))){const parsed=new URL(url);if(parsed.protocol==='https:'&&parsed.hostname==='a.espncdn.com')logos[String(team.id)]=url;}}}}catch{/* Missing artwork uses the team's initial; no invented source URL. */}
 return Response.json({...display,logos},{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}
