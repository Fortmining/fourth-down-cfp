import {NextResponse} from 'next/server';
import {equalSecret,oddsSession,privateOddsEnabled} from '../../../../lib/private-odds-auth';
export async function POST(request:Request){
 if(!privateOddsEnabled())return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 const secret=process.env.ODDS_DEV_ACCESS_TOKEN;
 if(!secret||secret.length<32||request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403,headers});
 const body=await request.json().catch(()=>null);
 if(typeof body?.token!=='string'||body.token.length>512||!equalSecret(body.token,secret))return new Response(null,{status:403,headers});
 const response=NextResponse.json({authenticated:true},{headers});
 response.cookies.set('fd-private-odds',oddsSession(secret),{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',maxAge:3600,path:'/api/private/odds'});return response;
}
