import {espnTeamSource,normalizeTeamGame} from '../../../lib/team-detail';
import {matchOddsEvent} from '../../../lib/odds-matching';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {privateOddsEnabled,validOddsSession} from '../../../lib/private-odds-auth';
import {privateOddsSnapshot,probePrivateOddsCache} from '../../../lib/private-odds-cache';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 if(!privateOddsEnabled())return new Response(null,{status:404,headers});
 const secret=process.env.ODDS_DEV_ACCESS_TOKEN;
 if(!secret||secret.length<32||!validOddsSession((await cookies()).get('fd-private-odds')?.value,secret))return NextResponse.json({error:'Private odds sign-in required'},{status:401,headers});
 if(new URL(request.url).searchParams.get('probe')==='cache'){try{return NextResponse.json(await probePrivateOddsCache(),{headers});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Private cache probe failed',providerCalled:false},{status:503,headers});}}
 const query=new URL(request.url).searchParams,date=query.get('date')||'',gameId=query.get('game')||'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return NextResponse.json({error:'Choose an authorized Eastern game date'},{status:400,headers});
 try{
  const snapshot=await privateOddsSnapshot(date,undefined,query.get('cachedOnly')==='1'||!!gameId,!gameId&&query.get('retryTransport')==='1');
  const publicSnapshot={...snapshot};delete publicSnapshot.source;
  const visible={...publicSnapshot,quotes:snapshot.quotes.filter(q=>Date.parse(q.startsAt)>Date.now())};
  if(!gameId)return NextResponse.json(visible,{headers});
  if(!/^\d{1,12}$/.test(gameId))return NextResponse.json({error:'Invalid game identifier'},{status:400,headers});
  const raw=await espnTeamSource(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${gameId}`,60),header=raw.header,c=header?.competitions?.[0];
  if(String(header?.id)!==gameId||header?.season?.year!==2026)throw Error('Game identity unavailable');
  const game=normalizeTeamGame({...header,date:c?.date});if(!game)throw Error('Game identity unavailable');
  const match=matchOddsEvent(game,snapshot.events||[]);
  return NextResponse.json({...visible,quotes:match.event?visible.quotes.filter(q=>q.eventId===match.event!.id):[],matching:{status:match.status,event:match.event,game:{id:game.id,name:game.name,date:game.date}}},{headers});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Private odds unavailable'},{status:503,headers});}
}
