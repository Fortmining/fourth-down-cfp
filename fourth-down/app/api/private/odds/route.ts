import {espnTeamSource,normalizeTeamGame} from '../../../lib/team-detail';
import {easternGameDate,matchOddsEvent} from '../../../lib/odds-matching';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {privateOddsEnabled} from '../../../lib/private-odds-auth';
import {authorizedDevice,deviceCookie,deviceSeconds,migrateOddsSession,oddsAdmin} from '../../../lib/odds-device-auth';
import {privateOddsSnapshot,probePrivateOddsCache} from '../../../lib/private-odds-cache';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
 if(!privateOddsEnabled())return new Response(null,{status:404,headers});
 try{
 const jar=await cookies();let migrated:string|null=null;
 if(!oddsAdmin(request)&&!await authorizedDevice(jar.get(deviceCookie)?.value)){
  migrated=await migrateOddsSession(jar.get('fd-private-odds')?.value);
  if(!migrated)return NextResponse.json({error:'This device needs one-time approval.',code:'DEVICE_APPROVAL_REQUIRED'},{status:401,headers});
 }
 const respond=(body:unknown)=>{const response=NextResponse.json(body,{headers});if(migrated){response.cookies.set(deviceCookie,migrated,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',maxAge:deviceSeconds,path:'/api/private/odds'});response.cookies.set('fd-private-odds','',{maxAge:0,path:'/api/private/odds'});}return response;};
 const query=new URL(request.url).searchParams,date=query.get('date')||'',gameId=query.get('game')||'',admin=oddsAdmin(request);
 if(admin&&query.get('probe')==='cache')return respond(await probePrivateOddsCache());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(!gameId&&!admin)||gameId&&!/^\d{1,12}$/.test(gameId))return NextResponse.json({error:'Invalid game request'},{status:400,headers});
 if(!gameId){const snapshot=await privateOddsSnapshot(date,undefined,query.get('cachedOnly')==='1');const {source:unused,...safe}=snapshot;void unused;return respond(safe);}
 const raw=await espnTeamSource(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${gameId}`,60),header=raw.header,c=header?.competitions?.[0];
 if(String(header?.id)!==gameId||header?.season?.year!==2026)throw Error('Game identity unavailable');
 const game=normalizeTeamGame({...header,date:c?.date});if(!game||easternGameDate(game.date)!==date)return NextResponse.json({error:'Game date does not match'},{status:400,headers});
 // Live/final games only read real captures. Never request historical or in-play prices.
 const snapshot=await privateOddsSnapshot(date,undefined,game.status!=='pre'||Date.parse(game.date)<=Date.now());
 const match=matchOddsEvent(game,snapshot.events||[],Date.now(),true);
 return respond({provider:snapshot.provider,observedAt:snapshot.observedAt,delaySeconds:snapshot.delaySeconds,quotes:match.event?snapshot.quotes.filter(q=>q.eventId===match.event!.id):[],expiresAt:snapshot.expiresAt});
 }catch{return NextResponse.json({error:'Pregame odds are unavailable for this game. Previously captured prices may have expired.'},{status:503,headers});}
}
