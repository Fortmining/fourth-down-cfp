import type {AlertFeed,AlertEvent} from './alerts';
import type {Poll} from './rankings';
type Witness={edition:string;publishedAt:number;lastSeenAt:number;pending?:AlertEvent};
export type RankingMemory={season:number|null;lastFeedAt:number;polls:Record<string,Witness>};
function verified(p:Poll,season:number|null,now:number){return p.season===season&&p.status==='available'&&!!p.date&&Number.isFinite(Date.parse(p.date))&&Date.parse(p.date)<=now&&now-Date.parse(p.date)<8*86400000&&p.teams.length>=25&&new Set(p.teams.map(t=>t.rank)).size===p.teams.length&&new Set(p.teams.map(t=>t.teamId)).size===p.teams.length&&p.teams.every(t=>t.rank>=1&&t.rank<=25&&Number.isInteger(t.rank));}
const edition=(p:Poll)=>`${p.id}:${p.season}:${p.week??p.date?.slice(0,10)}`;
export function recoverRankings(previous:AlertFeed|null,feed:AlertFeed,input:RankingMemory|null,now=Date.now()){
 const at=Date.parse(feed.updatedAt),state:RankingMemory=input?.season===feed.season?{...input,polls:{...input.polls}}:{season:feed.season,lastFeedAt:0,polls:{}};const events:AlertEvent[]=[];
 if(!feed.season||!Number.isFinite(at)||at>now+30000||now-at>90000||at<=state.lastFeedAt)return {state,events};
 for(const source of ['ap','coaches','cfp'] as const){
  const p=feed.polls.find(p=>p.id===source);if(!p||!verified(p,feed.season,now))continue;
  const prior=previous?.season===feed.season?previous.polls.find(p=>p.id===source):undefined;
  const bootstrap=prior&&verified(prior,feed.season,now)&&Number.isFinite(Date.parse(previous!.updatedAt))&&Date.parse(previous!.updatedAt)<=now?{edition:edition(prior),publishedAt:Date.parse(prior.date!),lastSeenAt:Date.parse(previous!.updatedAt)}:undefined;
  const old=state.polls[source]??bootstrap,id=edition(p);let pending=old?.pending;
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
