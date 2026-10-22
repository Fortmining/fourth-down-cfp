import { NextResponse } from 'next/server';
import { pushConfigured, redis } from '../../../lib/push-store';
export const dynamic='force-dynamic';
export async function GET() {
 let ready=false;let deliveryVerifiedAt:null|string=null;
 if(pushConfigured())try{const heartbeat=await redis('GET','fd:v05:heartbeat');ready=!!heartbeat&&Date.now()-Number(heartbeat)<360_000;const proof=await redis('GET','fd:v05:last-verified-delivery');deliveryVerifiedAt=proof?new Date(Number(proof)).toISOString():null;}catch{}
 return NextResponse.json({available:ready,deliveryVerifiedAt,publicKey:ready?process.env.VAPID_PUBLIC_KEY:null},{headers:{'Cache-Control':'no-store'}});
}
