import {american} from './game-extras.ts';
import type {Game} from './tracker-types';
export type OddsApiEvent={id:string;commence_time:string;home_team:string;away_team:string;bookmakers:{key:string;title:string;markets:{key:string;last_update?:string;outcomes:{name:string;price:number}[]}[]}[]};
const aliases:Record<string,string>={southernmississippigoldeneagles:'southernmissgoldeneagles',appalachianstatemountaineers:'appstatemountaineers',samhoustonstatebearkats:'samhoustonbearkats'};
const identity=(name:unknown)=>{if(typeof name!=='string')return '';const normalized=name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');return aliases[normalized]??normalized;};
// Do not infer live status from scheduled start. ESPN's confirmed state controls it.
export function oddsApiMoneyline(game:Game,events:OddsApiEvent[],observedAt:string,now=Date.now()){
 const observed=Date.parse(observedAt);
 if(!['pre','in'].includes(game.status)||game.kickoffTbd||/delay|suspend|postpon|cancel/i.test(game.detail)||!Number.isFinite(observed)||observed>now||now-observed>180000)return null;
 const home=game.teams.find(t=>t.homeAway==='home'),away=game.teams.find(t=>t.homeAway==='away');
 if(!home||!away||!Number.isFinite(Date.parse(game.date)))return null;
 const matched=events.filter(e=>e&&identity(e.home_team)===identity(home.name)&&identity(e.away_team)===identity(away.name)&&Math.abs(Date.parse(e.commence_time)-Date.parse(game.date))<=900000);
 if(matched.length!==1)return null;
 const event=matched[0];
 for(const key of ['draftkings','fanduel']){
  const book=Array.isArray(event.bookmakers)?event.bookmakers.find(b=>b?.key===key):undefined;
  const market=Array.isArray(book?.markets)?book.markets.find(m=>m?.key==='h2h'):undefined;
  if(!book||!market||!market.last_update||!Array.isArray(market.outcomes)||market.outcomes.length!==2)continue;
  const updated=Date.parse(market.last_update);
  if(!Number.isFinite(updated)||updated>observed||now-updated>180000)continue;
  // A recent fetch of old pregame prices is not evidence of live odds.
  if(game.status==='in'&&updated<Math.max(Date.parse(game.date),Date.parse(event.commence_time)))continue;
  const homePrice=american(market.outcomes.find(o=>identity(o?.name)===identity(home.name))?.price);
  const awayPrice=american(market.outcomes.find(o=>identity(o?.name)===identity(away.name))?.price);
  if(!homePrice||!awayPrice)continue;
  return {kind:game.status==='in'?'live':'pregame',provider:book.title,via:'The Odds API',sourceAt:market.last_update,observedAt,eventId:event.id,
   teams:[{id:away.id,name:away.name,moneyline:awayPrice},{id:home.id,name:home.name,moneyline:homePrice}]};
 }
 return null;
}
