import {NextResponse} from 'next/server';
import {unstable_cache} from 'next/cache';
async function redis(...command:(string|number)[]){
 const url=process.env.ODDS_PILOT_REDIS_URL;
 const token=process.env.ODDS_PILOT_REDIS_TOKEN;
 if(!url||!token)throw Error('Pilot accounting unavailable');
 const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(5000)});
 const body=await response.json();
 if(!response.ok||body.error)throw Error('Pilot accounting unavailable');
 return body.result;
}
export const dynamic='force-dynamic';
const budget='fd:{odds-pilot-20261105}:budget';
const deadline=Date.parse('2026-11-07T00:00:00Z');
const fetchSnapshot=unstable_cache(async()=>{
 if(Date.now()>deadline)throw Error('Pilot expired');
 // Each reserved attempt can cost at most one credit: one market, two books.
 // Failed and ambiguous attempts remain charged against this pilot's cap.
 const reserved=Number(await redis('EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=20 then return 0 end; redis.call('INCR',KEYS[1]); return n+1",1,budget));
 if(!reserved)throw Error('Pilot cap reached');
 const key=process.env.ODDS_API_KEY;if(!key)throw Error('Pilot key unavailable');
 const url=new URL('https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds');
 url.search=new URLSearchParams({apiKey:key,markets:'h2h',bookmakers:'draftkings,fanduel',oddsFormat:'american'}).toString();
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
 const header=(name:string)=>{const value=response.headers.get(name);return value!==null&&/^\d+$/.test(value)?Number(value):null;};
 const usage={reservedAttempts:reserved,last:header('x-requests-last'),accountUsed:header('x-requests-used'),accountRemaining:header('x-requests-remaining')};
 await redis('HSET','fd:{odds-pilot-20261105}:usage',String(reserved),JSON.stringify({at:new Date().toISOString(),status:response.status,...usage}));
 if(!response.ok)throw Error('Provider request failed; attempt retained');
 const events=await response.json();if(!Array.isArray(events))throw Error('Invalid provider response');
 return {observedAt:new Date().toISOString(),usage,events};
},['odds-api-supervised-pilot-20261105'],{revalidate:120});
export async function GET(request:Request){
 if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='codex/playoff-outlook-prototype')return new Response(null,{status:404});
 try{if(!process.env.ODDS_API_KEY)throw Error('Pilot key unavailable');
 if(new URL(request.url).searchParams.get('isolation')==='1'){
  const budgetValue=await redis('GET',budget);
  let productionDenied=false,otherKeyDenied=false;
  try{await redis('GET','fd:v05:heartbeat');}catch{productionDenied=true;}
  try{await redis('GET','fd:{odds-pilot-20261105}:outside-allowlist');}catch{otherKeyDenied=true;}
  return NextResponse.json({budgetValue,productionDenied,otherKeyDenied},{headers:{'Cache-Control':'private, no-store'}});
 }
 if(new URL(request.url).searchParams.get('quota')==='1'){
  const url=new URL('https://api.the-odds-api.com/v4/sports');
  url.searchParams.set('apiKey',process.env.ODDS_API_KEY);
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  const usage=Object.fromEntries(['x-requests-last','x-requests-used','x-requests-remaining'].map(name=>[name,response.headers.get(name)]));
  if(!response.ok)return NextResponse.json({error:'Quota check failed',status:response.status,usage},{status:503});
  const sports=await response.json();
  return NextResponse.json({usage,ncaaf:Array.isArray(sports)?sports.find(s=>s.key==='americanfootball_ncaaf'):null},{headers:{'Cache-Control':'private, no-store'}});
 }
 return NextResponse.json(await fetchSnapshot(),{headers:{'Cache-Control':'private, no-store'}});}
 catch(error){const allowed=['Pilot expired','Pilot cap reached','Pilot key unavailable','Provider request failed; attempt retained','Invalid provider response'];
 const message=error instanceof Error&&allowed.includes(error.message)?error.message:'Pilot unavailable';
 return NextResponse.json({error:message},{status:503,headers:{'Cache-Control':'no-store'}});}
}
