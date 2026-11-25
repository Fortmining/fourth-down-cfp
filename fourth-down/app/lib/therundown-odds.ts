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
 const priceUrl=`https://therundown.io/api/v2/sports/1/events/${date}?${query}`;
 const getPrices=()=>fetch(priceUrl,{headers:{'X-TheRundown-Key':key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 try{response=await getPrices();}catch{throw Error('Odds provider connection failed');}
 if(response.status===429){
  const error=await response.json().catch(()=>null),retryAfter=Number(response.headers.get('Retry-After')||1),left=count(response.headers.get('X-Datapoints-Remaining')),monthly=count(response.headers.get('X-Datapoints-Monthly-Remaining'));
  if(typeof error?.error==='string'&&/^Rate limit exceeded$/i.test(error.error)&&left!==0&&monthly!==0&&Number.isFinite(retryAfter)&&retryAfter<=5){
   await new Promise(resolve=>setTimeout(resolve,Math.max(1500,retryAfter*1000)));try{response=await getPrices();}catch{throw Error('Odds provider connection failed after bounded throttle backoff');}
  }else throw Error(typeof error?.error==='string'&&/daily|monthly|data point/i.test(error.error)?'Provider datapoint quota exhausted':'Provider rate limit reached; no automatic quota retry');
 }
 const datapoints=count(response.headers.get('X-Datapoints')),remaining=count(response.headers.get('X-Datapoints-Remaining'));
 if(!response.ok){await response.body?.cancel();throw Error(response.status===429?'Provider rate limit persisted after one bounded backoff':`Odds provider unavailable (HTTP ${response.status})`);}
 const observedAt=new Date().toISOString(),source=await response.json(),parsed=inspectRundown(source,Date.parse(observedAt),{scheduledOnly:true,mainOnly:true});
 const catalog:OddsDiagnostics['catalog']={status:parsed.quotes.length?'not-needed-prices-present':'unavailable',markets:[]};
 // Reference market metadata is unmetered. One scoped lookup, no retries or price polling.
 if(parsed.quotes.length===0)try{await new Promise(resolve=>setTimeout(resolve,1500));const q=new URLSearchParams({affiliate_ids:'19,23,22',include_counts:'1',offset:String(offset)});const r=await fetch(`https://therundown.io/api/v2/sports/1/markets/${date}?${q}`,{headers:{'X-TheRundown-Key':key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000)});if(r.ok){const b=await r.json(),list=Array.isArray(b.markets)?b.markets:Array.isArray(b)?b:Object.values(b).filter(Array.isArray).flat();catalog.status='available';catalog.markets=list.map((m:{market_id?:number;id?:number;name?:string;event_count?:number;open_event_count?:number})=>({id:m.market_id??m.id??0,name:m.name||'',events:m.event_count??null,openEvents:m.open_event_count??null}));}else{catalog.status='HTTP '+r.status;await r.body?.cancel();}}catch{catalog.status='reference-lookup-unavailable';}
 if(parsed.rawPriceRows===0&&!catalog.markets.some(m=>[1,2,3].includes(m.id)&&(m.openEvents??m.events??0)>0)){
  // Only if the requested books are empty, compare unmetered all-book market definitions.
  try{await new Promise(resolve=>setTimeout(resolve,1500));const q=new URLSearchParams({include_counts:'1',offset:String(offset)});const r=await fetch(`https://therundown.io/api/v2/sports/1/markets/${date}?${q}`,{headers:{'X-TheRundown-Key':key},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000)});if(r.ok){const b=await r.json(),list=Array.isArray(b.markets)?b.markets:Array.isArray(b)?b:Object.values(b).filter(Array.isArray).flat();catalog.widerStatus='available';catalog.widerMarkets=list.map((m:{market_id?:number;id?:number;name?:string;event_count?:number;open_event_count?:number})=>({id:m.market_id??m.id??0,name:m.name||'',events:m.event_count??null,openEvents:m.open_event_count??null}));}else{catalog.widerStatus='HTTP '+r.status;await r.body?.cancel();}}catch{catalog.widerStatus='reference-lookup-unavailable';}
 }
 return {provider:'TheRundown',source,observedAt,quotes:parsed.quotes,events:parsed.events,datapoints,remaining,delaySeconds:Math.max(300,count(response.headers.get('X-Data-Delay-Seconds'))||300),diagnostics:{date,timezone:'America/New_York',offsetMinutes:offset,providerEvents:parsed.events.length,rawPriceRows:parsed.rawPriceRows,acceptedPriceRows:parsed.quotes.length,marketIds:parsed.marketIds,bookIds:parsed.bookIds,rejected:parsed.rejected,catalog,request:{marketIds:[1,2,3],bookIds:[19,23,22],mainLine:true,hideClosed:true,scheduledOnly:true}}} satisfies OddsSnapshot;
}};
