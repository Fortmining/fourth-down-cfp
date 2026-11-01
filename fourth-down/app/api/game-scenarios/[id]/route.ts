import {latestReleasedResumes} from '../../../lib/playoff/resume-production';
import {releasedResumesEnabled} from '../../../lib/playoff/confirmed-release';
import {gameScenarios} from '../../../lib/game-scenarios';
export const dynamic='force-dynamic';export const maxDuration=15;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'private, max-age=60','X-Robots-Tag':'noindex'};const {id}=await params;
 if(!/^[1-9]\d{0,11}$/.test(id)||new URL(request.url).search)return Response.json({status:'unavailable',reason:'Invalid scenario request.'},{status:400,headers});
 if(!releasedResumesEnabled())return new Response('Not found',{status:404,headers});
 try{const packet=await latestReleasedResumes();if(!packet?.view)return Response.json({status:'unavailable',reason:'Confirmed snapshot unavailable. Try again later.'},{status:503,headers});return Response.json(gameScenarios(packet.view,id),{headers});}
 catch{return Response.json({status:'unavailable',reason:'Confirmed snapshot unavailable. Try again later.'},{status:503,headers});}
}
