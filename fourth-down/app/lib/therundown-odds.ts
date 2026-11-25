import type {OddsProvider,OddsQuote,OddsSnapshot} from './odds-provider';
import {american} from './game-extras.ts';
const books:Record<string,string>={'19':'DraftKings','23':'FanDuel','22':'BetMGM'};
type Price={price?:unknown;updated_at?:string;is_main_line?:boolean;closed_at?:string|null};
type Event={event_id?:string;sport_id?:number;event_date?:string;score?:{event_status?:string};schedule?:{event_name?:string};markets?:{market_id:number;period_id?:number;participants?:{id:string|number;name:string;lines?:{value?:string;prices?:Record<string,Price>}[]}[]}[]};
export function parseRundown(raw:unknown,now=Date.now()):OddsQuote[]{
 const events=(raw as {events?:Event[]})?.events;if(!Array.isArray(events))throw Error('Invalid odds response');
 const quotes:OddsQuote[]=[];
 for(const e of events){if(e.sport_id!==1||!e.event_id||!e.event_date||!Number.isFinite(Date.parse(e.event_date))||Date.parse(e.event_date)<=now||e.score?.event_status!=='STATUS_SCHEDULED')continue;
  for(const m of e.markets||[]){const market=({1:'moneyline',2:'spread',3:'total'} as const)[m.market_id as 1|2|3];if(!market||m.period_id!==0)continue;
   for(const p of m.participants||[])for(const line of p.lines||[])for(const [id,price] of Object.entries(line.prices||{})){
    const value=american(price.price);if(!books[id]||!value||price.closed_at||price.is_main_line!==true||!price.updated_at||!Number.isFinite(Date.parse(price.updated_at))||Date.parse(price.updated_at)>now||now-Date.parse(price.updated_at)>24*3600000||!p.name||p.id===undefined)continue;
    if(market!=='moneyline'&&(typeof line.value!=='string'||!line.value.trim()))continue;
    quotes.push({eventId:e.event_id,eventName:e.schedule?.event_name||e.event_id,startsAt:e.event_date,market,participant:p.name,participantId:String(p.id),line:market==='moneyline'?null:line.value!,book:books[id],american:value,updatedAt:price.updated_at});
   }
  }
 }
 return quotes;
}
function count(value:string|null){return value!==null&&/^\d+$/.test(value)?Number(value):null;}
export const therundownProvider:OddsProvider={id:'therundown',async fetchPregame(date){
 const key=process.env.THERUNDOWN_API_KEY||process.env.rundown;if(!key)throw Error('Configure THERUNDOWN_API_KEY');
 const query=new URLSearchParams({market_ids:'1,2,3',affiliate_ids:'19,23,22',main_line:'true',hide_closed:'true',odds_format:'american'});
 const response=await fetch(`https://therundown.io/api/v2/sports/1/events/${date}?${query}`,{headers:{'X-TheRundown-Key':key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 const datapoints=count(response.headers.get('X-Datapoints')),remaining=count(response.headers.get('X-Datapoints-Remaining'));
 if(!response.ok){await response.body?.cancel();throw Error(response.status===429?'Provider quota exhausted':'Odds provider unavailable');}
 const observedAt=new Date().toISOString(),quotes=parseRundown(await response.json(),Date.parse(observedAt));
 return {provider:'TheRundown',observedAt,quotes,datapoints,remaining,delaySeconds:Math.max(300,count(response.headers.get('X-Data-Delay-Seconds'))||300)} satisfies OddsSnapshot;
}};
