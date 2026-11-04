import type {AlertFeed,AlertEvent,AlertPreferences} from './alerts';
import type {Poll} from './rankings';
type Witness={edition:string;publishedAt:number;lastSeenAt:number;pending?:AlertEvent};
export type RankingMemory={season:number|null;lastFeedAt:number;polls:Record<string,Witness>};
function verified(p:Poll,season:number|null,now:number){return p.season===season&&(p.status==='available'||(p.id==='cfp'&&p.status==='awaiting_update'))&&!!p.date&&Number.isFinite(Date.parse(p.date))&&Date.parse(p.date)<=now&&now-Date.parse(p.date)<8*86400000&&p.teams.length>=25&&new Set(p.teams.map(t=>t.rank)).size===p.teams.length&&new Set(p.teams.map(t=>t.teamId)).size===p.teams.length&&p.teams.every(t=>t.rank>=1&&t.rank<=25&&Number.isInteger(t.rank));}
const cfpEditionDate = (p: Poll) => new Date(p.date!).toISOString().slice(0, 10);
const edition=(p:Poll)=>p.id==='cfp'? `cfp:${p.season}:${cfpEditionDate(p)}` :`${p.id}:${p.season}:${p.week??p.date?.slice(0,10)}`;
export function recoverRankings(previous:AlertFeed|null,feed:AlertFeed,input:RankingMemory|null,now=Date.now()){
 const at=Date.parse(feed.updatedAt),state:RankingMemory=input?.season===feed.season?{...input,polls:{...input.polls}}:{season:feed.season,lastFeedAt:0,polls:{}};const events:AlertEvent[]=[];
 if(!feed.season||!Number.isFinite(at)||at>now+30000||now-at>90000||at<=state.lastFeedAt)return {state,events};
 for(const source of ['ap','coaches','cfp'] as const){
  const p=feed.polls.find(p=>p.id===source);if(!p||!verified(p,feed.season,now))continue;
  const prior=previous?.season===feed.season?previous.polls.find(p=>p.id===source):undefined;
  const bootstrap=prior&&verified(prior,feed.season,now)&&Number.isFinite(Date.parse(previous!.updatedAt))&&Date.parse(previous!.updatedAt)<=now?{edition:edition(prior),publishedAt:Date.parse(prior.date!),lastSeenAt:Date.parse(previous!.updatedAt)}:undefined;
  const old=state.polls[source]??bootstrap,id=edition(p);let pending=old?.pending;
  if(source==='cfp'){
   const publishedAt=Date.parse(p.date!);
   // A known older edition witnesses a transition. On a cold start,
   // accept only the current or prior Eastern day to avoid historical alerts.
   const easternDay = new Intl.DateTimeFormat('en-CA', {
    timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',
   });
   const today = Date.parse(easternDay.format(now));
   const recent = publishedAt >= today-86400000;
   const oldDate=old?new Date(old.publishedAt).toISOString().slice(0,10):null;
   const date=cfpEditionDate(p);
   if(oldDate&&date<oldDate)continue;
   // The November 3, 2026 edition predates this alert policy.
   if(!oldDate||date>oldDate){
    pending=(oldDate!==null||recent)&&date>'2026-11-03'?{
     id:`poll:${id}`,types:['cfp'],teamIds:[],title:'CFP Top 25 is out',
     body:'The committee published a new Top 25. See the complete rankings.',
     url:'/rankings',observedAt:now,eligibilityAt:now,
     expiresAt:now+300000,
     cfpRanks:p.teams.map(({teamId,rank,previous})=>({teamId,rank,previous})),
    }:undefined;
   }
   state.polls[source]={edition:id,publishedAt,lastSeenAt:now,pending};
   if(pending&&pending.expiresAt!>now&&pending.id===`poll:${id}`)events.push(pending);
   continue;
  }
  if(old&&old.edition!==id){
   pending=undefined;
   if(Date.parse(p.date!)>old.publishedAt&&now-old.lastSeenAt<=3600000){
    const gap=!previous||!prior||prior.status!=='available'||now-Date.parse(previous.updatedAt)>300000;
    pending={id:`poll:${id}`,types:[source],teamIds:[],title:`New ${p.name} published`,body:`Published ${p.date!.slice(0,10)}${p.week?` · Week ${p.week}`:''}. View the actual published edition.`,url:`/?ranking=${source}#rankings-heading`,observedAt:now,eligibilityAt:gap?old.lastSeenAt:now,expiresAt:now+300000};
   }
  }
  state.polls[source]={edition:id,publishedAt:Date.parse(p.date!),lastSeenAt:now,pending};
  if(pending&&pending.expiresAt!>now&&pending.id===`poll:${id}`)events.push(pending);
 }
 state.lastFeedAt=at;return {state,events};
}


export function personalizeCfpEdition(event: AlertEvent, preferences: AlertPreferences): AlertEvent {
 if (!event.cfpRanks || !preferences.favorites.length) return event;
 const ranks = new Map(event.cfpRanks.map(row => [row.teamId, row]));
 const favorites = preferences.favorites.slice(0, 3).map(team => {
  const row = ranks.get(team.id);
  if (!row) return `${team.name} is outside the Top 25`;
  const previous = row.previous;
  const movement = previous && previous <= 25
   ? previous === row.rank ? ' (unchanged)' : previous > row.rank ? ` (up ${previous-row.rank})` : ` (down ${row.rank-previous})`
   : '';
  return `${team.name} No. ${row.rank}${movement}`;
 });
 return { ...event, body: `${favorites.join(' · ')}. See the complete CFP Top 25.` };
}
