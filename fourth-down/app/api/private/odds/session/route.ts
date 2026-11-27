import {NextResponse} from 'next/server';
import {privateOddsEnabled} from '../../../../lib/private-odds-auth';
import {deviceCookie,deviceSeconds,enrollDevice,sameOrigin} from '../../../../lib/odds-device-auth';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 if(!privateOddsEnabled())return new Response(null,{status:404,headers});
 if(!sameOrigin(request))return new Response(null,{status:403,headers});
 const body=await request.json().catch(()=>null);
 if(typeof body?.approval!=='string')return new Response(null,{status:403,headers});
 try{const value=await enrollDevice(body.approval),response=NextResponse.json({authorized:true},{headers});
 response.cookies.set(deviceCookie,value,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',maxAge:deviceSeconds,path:'/api/private/odds'});return response;
 }catch{return NextResponse.json({error:'Device approval is expired, already used, or unavailable. Request a new approval link.'},{status:403,headers});}
}
