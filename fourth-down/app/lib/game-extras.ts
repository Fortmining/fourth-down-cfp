type Link = {href?:string;rel?:string[]};
type Price = {moneyLine?:number;teamId?:string;team?:{id?:string}};
type Market = {provider?:{name?:string};lastUpdated?:string;updatedAt?:string;isLive?:boolean;homeTeamOdds?:Price;awayTeamOdds?:Price;moneyline?:{home?:{close?:{odds?:string};current?:{odds?:string}};away?:{close?:{odds?:string};current?:{odds?:string}}}};
export type OddsEvent = {id?:string;status?:{type?:{state?:string}};competitions?:{status?:{type?:{state?:string}};competitors?:{homeAway?:string;team?:{id?:string;displayName?:string}}[];odds?:Market[]}[]};
export function american(value:unknown){
 const number=typeof value==='number'?value:typeof value==='string'&&/^[+-]?\d+$/.test(value)?Number(value):NaN;
 return Number.isInteger(number)&&Math.abs(number)>=100&&Math.abs(number)<=100000?(number>0?'+':'')+number:null;
}
export function gameMoneyline(event:OddsEvent,observedAt:string){
 const competition=event.competitions?.[0],state=competition?.status?.type?.state??event.status?.type?.state;
 if(!['pre','in'].includes(state??''))return null;
 for(const market of competition?.odds??[]){
  const sourceAt=market.lastUpdated??market.updatedAt;
  const fresh=!!sourceAt&&Date.parse(sourceAt)<=Date.parse(observedAt)&&Date.parse(observedAt)-Date.parse(sourceAt)<=180000;
  if(state==='in'&&(!fresh||market.isLive!==true))continue;
  const prices=state==='in'?market.moneyline:undefined;
  const home=american(prices?.home?.current?.odds??(state==='pre'?market.homeTeamOdds?.moneyLine??market.moneyline?.home?.close?.odds:undefined));
  const away=american(prices?.away?.current?.odds??(state==='pre'?market.awayTeamOdds?.moneyLine??market.moneyline?.away?.close?.odds:undefined));
  const teams=['away','home'].map(side=>competition?.competitors?.find(team=>team.homeAway===side));
  if(!home||!away||!teams.every(team=>team?.team?.id)||!market.provider?.name)continue;
  return {kind:state==='in'?'live':'pregame',provider:market.provider.name,sourceAt:sourceAt??null,observedAt,
   teams:teams.map((team,index)=>({id:team!.team!.id!,name:team!.team!.displayName??'Team',moneyline:index===0?away:home}))};
 }
 return null;
}
export function watchDestination(links:Link[],broadcast:string){
 for(const link of links){
  if(!link.rel?.some(rel=>['watch','live','stream'].includes(rel))||!link.href)continue;
  try{const url=new URL(link.href);if(url.protocol==='https:'&&!url.username&&!url.password&&
   ['www.espn.com','espn.com','www.cbssports.com','www.foxsports.com','www.peacocktv.com'].includes(url.hostname)&&
   /\/watch\/|\/watch$|\/live\//.test(url.pathname))return {url:url.href,label:'Watch Live',exact:true};}catch{}
 }
 if(/\b(ESPN|ESPNU|ESPN2|ABC|ACC Network|SEC Network)\b/i.test(broadcast))return {url:'https://www.espn.com/watch/',label:'Open ESPN Watch',exact:false};
 if(/CBSSN|CBS Sports Network/i.test(broadcast))return {url:'https://www.cbssports.com/watch/cbs-sports-network',label:'Open CBS Sports Network',exact:false};
 return null;
}
