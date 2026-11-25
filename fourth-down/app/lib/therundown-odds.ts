import type {OddsProvider,OddsQuote,OddsSnapshot,OddsEventSummary,OddsDiagnostics} from './odds-provider';
import {american} from './game-extras.ts';
import {easternOffset} from './odds-matching.ts';
const books:Record<string,string>={'19':'DraftKings','23':'FanDuel','22':'BetMGM'};
type Price={price?:unknown;updated_at?:string;is_main_line?:boolean;closed_at?:string|null};
type Event={event_id?:string;sport_id?:number;event_date?:string;event_status?:string;score?:{event_status?:string};teams?:{team_id:string|number;name:string;mascot?:string;is_home?:boolean;is_away?:boolean}[];schedule?:{event_name?:string};markets?:{market_id:number;period_id?:number;participants?:{id:string|number;name:string;lines?:{value?:string;prices?:Record<string,Price>}[]}[]}[]};
export function inspectRundown(raw:unknown,now=Date.now(),scope={scheduledOnly:false,mainOnly:false}){
 const input=(raw as {events?:Event[]})?.events;if(!Array.isArray(input))throw Error('Invalid odds response');
 const quotes:OddsQuote[]=[],events:OddsEventSummary[]=[],rejected:Record<string,number>={},allMarkets=new Set<number>(),allBooks=new Set<string>();let rawPriceRows=0;
 const reject=(why:string)=>{rejected[why]=(rejected[why]||0)+1;};
 for(const e of input){const marketIds=new Set<number>(),bookIds=new Set<string>();let rows=0;const start=quotes.length,status=e.score?.event_status||e.event_status||(scope.scheduledOnly?'STATUS_SCHEDULED':'missing');
  for(const m of e.markets||[]){marketIds.add(m.market_id);allMarkets.add(m.market_id);}
  for(const m of e.markets||[])for(const p of m.participants||[])for(const l of p.lines||[])for(const id of Object.keys(l.prices||{})){rows++;marketIds.add(m.market_id);bookIds.add(id);allMarkets.add(m.market_id);allBooks.add(id);}rawPriceRows+=rows;
  const valid=e.sport_id===1&&!!e.event_id&&!!e.event_date&&Number.isFinite(Date.parse(e.event_date))&&Date.parse(e.event_date)>now&&status==='STATUS_SCHEDULED';
  if(!valid)reject('event-not-verified-future-pregame');
  if(valid)for(const m of e.markets||[]){const market=({1:'moneyline',2:'spread',3:'total'} as const)[m.market_id as 1|2|3];if(!market||m.period_id!==0){reject('market-or-period');continue;}
   for(const p of m.participants||[])for(const line of p.lines||[])for(const [id,price] of Object.entries(line.prices||{})){
    if(!books[id]){reject('sportsbook');continue;}const value=american(price.price);if(!value){reject('off-board-or-invalid-price');continue;}
    if(price.closed_at){reject('closed-price');continue;}if(price.is_main_line===false||(!scope.mainOnly&&price.is_main_line!==true)){reject('not-confirmed-main');continue;}
    if(!price.updated_at||!Number.isFinite(Date.parse(price.updated_at))||Date.parse(price.updated_at)>now){reject('missing-or-future-price-time');continue;}
    if(!p.name||p.id===undefined||(market!=='moneyline'&&(typeof line.value!=='string'||!line.value.trim()))){reject('participant-or-line');continue;}
    quotes.push({eventId:e.event_id!,eventName:e.schedule?.event_name||e.event_id!,startsAt:e.event_date!,market,participant:p.name,participantId:String(p.id),line:market==='moneyline'?null:line.value!,book:books[id],american:value,updatedAt:price.updated_at,olderUpdate:now-Date.parse(price.updated_at)>24*3600000});
   }
  }
  if(e.event_id&&e.event_date)events.push({id:e.event_id,name:e.schedule?.event_name||e.event_id,startsAt:e.event_date,status,teams:(e.teams||[]).map(t=>({id:String(t.team_id),name:t.mascot&&!t.name.toLowerCase().endsWith(t.mascot.toLowerCase())?t.name+' '+t.mascot:t.name,side:t.is_home?'home':t.is_away?'away':'unknown'})),marketIds:[...marketIds],bookIds:[...bookIds],rawPriceRows:rows,acceptedPriceRows:quotes.length-start});
 }
 return {quotes,events,rawPriceRows,marketIds:[...allMarkets],bookIds:[...allBooks],rejected};
}
export function parseRundown(raw:unknown,now=Date.now()){return inspectRundown(raw,now).quotes;}
function count(value:string|null){return value!==null&&/^\d+$/.test(value)?Number(value):null;}
export const therundownProvider:OddsProvider={id:'therundown',async fetchPregame(date){
 const key=process.env.THERUNDOWN_API_KEY||process.env.rundown;if(!key)throw Error('Configure the server-side TheRundown key');if(/[\r\n]/.test(key))throw Error('TheRundown key contains a line break');
 const offset=easternOffset(date),filters={market_ids:'1,2,3',affiliate_ids:'19,23,22',main_line:'true',hide_closed:'true',odds_format:'american',offset:String(offset),event_status:'STATUS_SCHEDULED'};
 const query=new URLSearchParams(filters);let response:Response;
 try{response=await fetch(`https://therundown.io/api/v2/sports/1/events/${date}?${query}`,{headers:{'X-TheRundown-Key':key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw Error('Odds provider connection failed');}
 const datapoints=count(response.headers.get('X-Datapoints')),remaining=count(response.headers.get('X-Datapoints-Remaining'));
 if(!response.ok){await response.body?.cancel();throw Error(response.status===429?'Provider quota exhausted':`Odds provider unavailable (HTTP ${response.status})`);}
 const observedAt=new Date().toISOString(),source=await response.json(),parsed=inspectRundown(source,Date.parse(observedAt),{scheduledOnly:true,mainOnly:true});
 const catalog:OddsDiagnostics['catalog']={status:'unavailable',markets:[]};
 // Reference market metadata is unmetered. One scoped lookup, no retries or price polling.
 try{const q=new URLSearchParams({affiliate_ids:'19,23,22',include_counts:'1',offset:String(offset)});const r=await fetch(`https://therundown.io/api/v2/sports/1/markets/${date}?${q}`,{headers:{'X-TheRundown-Key':key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000)});if(r.ok){const b=await r.json(),list=Array.isArray(b.markets)?b.markets:Array.isArray(b)?b:Object.values(b).filter(Array.isArray).flat();catalog.status='available';catalog.markets=list.map((m:{market_id?:number;id?:number;name?:string;event_count?:number;open_event_count?:number})=>({id:m.market_id??m.id??0,name:m.name||'',events:m.event_count??null,openEvents:m.open_event_count??null}));}else{catalog.status='HTTP '+r.status;await r.body?.cancel();}}catch{catalog.status='reference-lookup-unavailable';}
 return {provider:'TheRundown',source,observedAt,quotes:parsed.quotes,events:parsed.events,datapoints,remaining,delaySeconds:Math.max(300,count(response.headers.get('X-Data-Delay-Seconds'))||300),diagnostics:{date,timezone:'America/New_York',offsetMinutes:offset,providerEvents:parsed.events.length,rawPriceRows:parsed.rawPriceRows,acceptedPriceRows:parsed.quotes.length,marketIds:parsed.marketIds,bookIds:parsed.bookIds,rejected:parsed.rejected,catalog,request:{marketIds:[1,2,3],bookIds:[19,23,22],mainLine:true,hideClosed:true,scheduledOnly:true}}} satisfies OddsSnapshot;
}};
