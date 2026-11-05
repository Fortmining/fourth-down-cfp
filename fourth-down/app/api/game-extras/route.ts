import {NextResponse} from 'next/server';
import {gameMoneyline,type OddsEvent} from '../../lib/game-extras';
export async function GET(){
 try{
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=150',{next:{revalidate:120},signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw Error('Provider unavailable');
  const raw=await response.json();if(!Array.isArray(raw.events))throw Error('Invalid scoreboard');
  const observedAt=new Date().toISOString();
  const odds=Object.fromEntries(raw.events.slice(0,150).map((event:OddsEvent)=>[event.id,gameMoneyline(event,observedAt)]));
  return NextResponse.json({observedAt,odds},{headers:{'Cache-Control':'public, s-maxage=120'}});
 }catch{return NextResponse.json({error:'Moneylines unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
