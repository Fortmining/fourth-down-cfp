import {NextResponse} from 'next/server';
import {gameMoneyline,type OddsEvent} from '../../lib/game-extras';
import {liveMoneylineSnapshot} from '../../lib/live-moneyline-feed';
import {oddsApiMoneyline} from '../../lib/odds-api-moneyline';
import type {Game} from '../../lib/tracker-types';

type ScoreboardEvent = OddsEvent & {date?: string; status?: {type?: {name?: string}}};
function liveGame(event: ScoreboardEvent): Game | null {
 const competition = event.competitions?.[0];
 const providerStatus = event.status?.type?.name ?? '';
 if ((competition?.status?.type?.state ?? event.status?.type?.state) !== 'in' ||
     !event.date || /delay|suspend|postpon|cancel/i.test(providerStatus)) return null;
 const teams = (competition?.competitors ?? []).flatMap(({homeAway,team}) =>
  team?.id && team.displayName && (homeAway === 'home' || homeAway === 'away')
   ? [{id: team.id, name: team.displayName, homeAway, record: ''}] : []);
 return event.id && teams.length === 2
  ? {id:event.id,date:event.date,status:'in',teams,detail:'',name:'',broadcast:''} : null;
}

export async function GET(){
 try{
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=150',{next:{revalidate:30},signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw Error('Provider unavailable');
  const raw=await response.json();if(!Array.isArray(raw.events))throw Error('Invalid scoreboard');
  const events: ScoreboardEvent[] = raw.events.slice(0,150);
  const live = events.map(liveGame).filter((game): game is Game => game !== null);
  const snapshot = live.length ? await liveMoneylineSnapshot() : null;
  const observedAt=new Date().toISOString();
  const odds=Object.fromEntries(events.map((event)=>[event.id,gameMoneyline(event,observedAt)]));
  if (snapshot) {
   for (const game of live) {
    const quote = oddsApiMoneyline(game, snapshot.events, snapshot.observedAt);
    if (quote) odds[game.id] = quote;
   }
  }
  const cacheControl = live.length ? 'public, s-maxage=15' : 'public, s-maxage=30';
  return NextResponse.json({observedAt,odds},{headers:{'Cache-Control':cacheControl}});
 }catch{return NextResponse.json({error:'Moneylines unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
