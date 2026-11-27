import {equalSecret,privateOddsEnabled} from '../../../../lib/private-odds-auth';
import {easternGameDate} from '../../../../lib/odds-matching';
import {oddsVerificationDates,privateOddsSnapshot} from '../../../../lib/private-odds-cache';
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,headers={'Cache-Control':'private, no-store'};
 if(!privateOddsEnabled()||process.env.VERCEL_ENV!=='production'||!secret||!equalSecret(request.headers.get('authorization')||'','Bearer '+secret))return new Response(null,{status:401,headers});
 const date=easternGameDate(new Date().toISOString());
 if(!oddsVerificationDates.some(d=>d===date))return Response.json({active:false},{headers});
 try{const snapshot=await privateOddsSnapshot(date);return Response.json({captured:!snapshot.cached,date,quotes:snapshot.quotes.length},{headers});}
 catch{return Response.json({error:'Capture unavailable; quota reservation preserved'},{status:503,headers});}
}
