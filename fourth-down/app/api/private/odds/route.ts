import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {privateOddsEnabled,validOddsSession} from '../../../lib/private-odds-auth';
import {privateOddsSnapshot,probePrivateOddsCache} from '../../../lib/private-odds-cache';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 if(!privateOddsEnabled())return new Response(null,{status:404,headers});
 const secret=process.env.ODDS_DEV_ACCESS_TOKEN;
 if(!secret||secret.length<32||!validOddsSession((await cookies()).get('fd-private-odds')?.value,secret))return NextResponse.json({error:'Private developer sign-in required'},{status:401,headers});
 if(new URL(request.url).searchParams.get('probe')==='cache'){try{return NextResponse.json(await probePrivateOddsCache(),{headers});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Private cache probe failed',providerCalled:false},{status:503,headers});}}
 const date=new URL(request.url).searchParams.get('date')||'',at=Date.parse(date+'T00:00:00Z'),today=Date.parse(new Date().toISOString().slice(0,10)+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(at)||new Date(at).toISOString().slice(0,10)!==date||at<today||at>today+7*86400000)return NextResponse.json({error:'Choose a UTC date from today through the next seven days'},{status:400,headers});
 try{return NextResponse.json(await privateOddsSnapshot(date),{headers});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Private odds unavailable'},{status:503,headers});}
}
