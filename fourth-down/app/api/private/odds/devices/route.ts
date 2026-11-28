import {NextResponse} from 'next/server';
import {privateOddsEnabled} from '../../../../lib/private-odds-auth';
import {issueDeviceApproval,oddsAdmin,revokeOddsDevices} from '../../../../lib/odds-device-auth';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
export async function POST(request:Request){
 if(!privateOddsEnabled()||!oddsAdmin(request))return new Response(null,{status:401,headers});
 const body=await request.json().catch(()=>null);
 try{const approval=await issueDeviceApproval(body?.person,body?.format==='code');return NextResponse.json({approval,expiresIn:86400},{headers});}catch{return NextResponse.json({error:'Unable to create device approval'},{status:400,headers});}
}
export async function DELETE(request:Request){
 if(!privateOddsEnabled()||!oddsAdmin(request))return new Response(null,{status:401,headers});
 const body=await request.json().catch(()=>null);
 try{await revokeOddsDevices(body?.person);return NextResponse.json({revoked:true},{headers});}catch{return new Response(null,{status:400,headers});}
}
