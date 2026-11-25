import type {OddsEventSummary} from './odds-provider';
export type MatchGame={id:string;date:string;status:string;kickoffTbd?:boolean;teams:{id:string;name:string;homeAway?:string}[]};
const aliases:Record<string,string>={southernmississippigoldeneagles:'southernmissgoldeneagles',appalachianstatemountaineers:'appstatemountaineers',samhoustonstatebearkats:'samhoustonbearkats',mississippirebels:'olemissrebels',connecticuthuskies:'uconnhuskies',northcarolinastatewolfpack:'ncstatewolfpack',texassanantonioroadrunners:'utsaroadrunners',miamiflhurricanes:'miamihurricanes'};
export function oddsTeamIdentity(name:string){const value=name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');return aliases[value]||value;}
export function easternGameDate(at:string){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));}
export function easternOffset(date:string){const noon=new Date(date+'T12:00:00Z');const local=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).format(noon);return (12-Number(local))*60;}
export function matchOddsEvent(game:MatchGame,events:OddsEventSummary[],now=Date.now()){
 const home=game.teams.find(t=>t.homeAway==='home'),away=game.teams.find(t=>t.homeAway==='away');
 if(game.status!=='pre'||game.kickoffTbd||!home||!away||!Number.isFinite(Date.parse(game.date))||Date.parse(game.date)<=now)return {status:'not-pregame',event:null};
 const pair=events.filter(e=>e.teams.some(t=>t.side==='home'&&oddsTeamIdentity(t.name)===oddsTeamIdentity(home.name))&&e.teams.some(t=>t.side==='away'&&oddsTeamIdentity(t.name)===oddsTeamIdentity(away.name)));
 const matches=pair.filter(e=>Math.abs(Date.parse(e.startsAt)-Date.parse(game.date))<=15*60000&&e.status==='STATUS_SCHEDULED');
 return {status:matches.length===1?'matched':matches.length>1?'ambiguous':pair.length?'kickoff-or-status-mismatch':'team-pair-not-matched',event:matches.length===1?matches[0]:null};
}
