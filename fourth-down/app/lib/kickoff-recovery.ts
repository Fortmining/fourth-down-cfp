import type {AlertEvent,AlertFeed,AlertGame,AlertPreferences} from './alerts';
import type {SavedSubscription} from './push-store';
export const KICKOFF_WINDOW_MS=12*60_000;
export type KickoffAccess={favorites:Record<string,number>;follows:Record<string,number>;favoriteEnabledAt:number;followingEnabledAt:number};
type Witness={scheduledAt:number;teamIds:string[];lastSeenAt:number;firstLiveAt?:number;terminal?:boolean};
export type KickoffMemory={season:number|null;lastFeedAt:number;games:Record<string,Witness>};
const numeric=(id:string)=>/^\d{1,12}$/.test(id);
const teams=(g:AlertGame)=>g.teams.map(t=>t.id).sort();
const sameTeams=(a:string[],b:string[])=>a.length===2&&b.length===2&&a[0]===b[0]&&a[1]===b[1]&&a[0]!==a[1]&&a.every(numeric);
const pre=(g:AlertGame)=>g.status==='pre'&&/^STATUS_(SCHEDULED|DELAYED|POSTPONED)$/.test(g.providerStatus||'');
const live=(g:AlertGame)=>g.status==='in'&&g.providerStatus==='STATUS_IN_PROGRESS'&&g.completed!==true;
export function recoverKickoffs(previous:AlertFeed|null,current:AlertFeed,input:unknown,now=Date.now()) {
 const supplied=input as KickoffMemory|null;
 const validSeason=Number.isInteger(current.season)&&Number(current.season)>=2020&&Number(current.season)<=2100;
 const memory:KickoffMemory={season:current.season,lastFeedAt:0,games:{}};
 if(supplied?.season===current.season&&supplied.games&&typeof supplied.games==='object'){
  memory.lastFeedAt=Number.isFinite(supplied.lastFeedAt)?supplied.lastFeedAt:0;
  for(const [id,w] of Object.entries(supplied.games))if(numeric(id)&&w&&Number.isFinite(w.scheduledAt)&&Array.isArray(w.teamIds)&&sameTeams(w.teamIds,w.teamIds)&&Number.isFinite(w.lastSeenAt)&&w.lastSeenAt>=now-2*86400_000&&w.lastSeenAt<=now+30_000)memory.games[id]={...w};
 }
 const events:AlertEvent[]=[],decisions:Record<string,{reason:string;eligibilityAt?:number;expiresAt?:number}>={};
 const currentAt=Date.parse(current.updatedAt);
 const gate=!validSeason?'invalid-season':!Number.isFinite(currentAt)?'invalid-feed-time':currentAt>now+30_000?'future-feed':now-currentAt>90_000?'stale-feed':current.scoreboardAvailable===false?'scoreboard-unavailable':currentAt<=memory.lastFeedAt?'feed-not-advanced':null;
 if(gate){for(const g of current.games)decisions[g.id]={reason:gate};return {memory,events,decisions,gate};}
 // Bootstrap from an existing server baseline, never from a newly live game.
 const seedAt=previous?Date.parse(previous.updatedAt):NaN;
 if(previous?.season===current.season&&Number.isFinite(seedAt)&&seedAt<=now&&now-seedAt<86400_000){
  for(const g of previous.games)if(!memory.games[g.id]&&numeric(g.id)&&pre(g)&&sameTeams(teams(g),teams(g))&&Number.isFinite(Date.parse(g.date)))memory.games[g.id]={scheduledAt:Date.parse(g.date),teamIds:teams(g),lastSeenAt:seedAt};
 }
 for(const g of current.games){
  if(!numeric(g.id))continue;
  const teamIds=teams(g),date=Date.parse(g.date);let w=memory.games[g.id];
  if(!sameTeams(teamIds,teamIds)){decisions[g.id]={reason:'invalid-game-identity'};continue;}
  if(w&&!sameTeams(teamIds,w.teamIds)){decisions[g.id]={reason:'game-identity-changed'};continue;}
  if(pre(g)&&(!w||(!w.firstLiveAt&&!w.terminal))&&Number.isFinite(date)&&date>=now-KICKOFF_WINDOW_MS&&date<=now+14*86400_000){w={scheduledAt:date,teamIds,lastSeenAt:now};memory.games[g.id]=w;}
  if(!w){decisions[g.id]={reason:'no-pregame-witness'};continue;}
  w.lastSeenAt=now;
  if(g.status==='post'||g.completed===true||/^STATUS_(CANCELED|CANCELLED|FINAL)/.test(g.providerStatus||''))w.terminal=true;
  if(g.status==='in'&&w.firstLiveAt===undefined)w.firstLiveAt=now;
  const eligibilityAt=Math.min(w.scheduledAt,w.firstLiveAt??w.scheduledAt),expiresAt=w.scheduledAt+KICKOFF_WINDOW_MS;
  let reason='kickoff-recovered';
  if(w.terminal)reason='terminal-game';
  else if(!live(g))reason='not-confirmed-live';
  else if(!Number.isFinite(date)||date!==w.scheduledAt)reason='scheduled-time-changed-or-invalid';
  else if(now<w.scheduledAt)reason='premature-live';
  else if(now>=expiresAt)reason='kickoff-window-expired';
  else if(g.period!==1||!Number.isFinite(g.clock)||Number(g.clock)<=0||Number(g.clock)>=900)reason='not-confirmed-first-quarter-progress';
  else if((900-Number(g.clock))*1000>now-w.scheduledAt+90_000)reason='clock-ahead-of-wall-time';
  decisions[g.id]={reason,eligibilityAt,expiresAt};
  if(reason==='kickoff-recovered')events.push({id:`game:${g.id}:kickoff`,types:['kickoff'],teamIds,title:'Kickoff confirmed',body:g.name,url:`/game/${g.id}`,observedAt:now,eligibilityAt,expiresAt});
 }
 memory.lastFeedAt=currentAt;
 // Bound storage independently of source size; overflow suppresses recovery.
 if(Object.keys(memory.games).length>2000)return {memory:{...memory,games:{}},events:[],decisions:{},gate:'witness-capacity-exceeded'};
 return {memory,events,decisions,gate:'ready'};
}
const key=(f:NonNullable<AlertPreferences['following']>['items'][number])=>`${f.kind}:${f.id}`;
export function kickoffAccessTimes(old:SavedSubscription|null,p:AlertPreferences,now:number):KickoffAccess {
 const legacy=old?old.kickoffAccess??{favorites:Object.fromEntries(old.preferences.favorites.map(t=>[t.id,old.updatedAt])),follows:Object.fromEntries((old.preferences.following?.items||[]).map(f=>[key(f),old.updatedAt])),favoriteEnabledAt:old.updatedAt,followingEnabledAt:old.updatedAt}:null;
 const favoriteOn=p.myTeams.enabled&&p.myTeams.kickoff,followingOn=p.following?.enabled===true;
 return {favorites:Object.fromEntries(p.favorites.map(t=>[t.id,legacy?.favorites[t.id]??now])),follows:Object.fromEntries((p.following?.items||[]).map(f=>{
  const same=old?.preferences.following?.items.find(x=>key(x)===key(f)&&x.createdAt===f.createdAt&&x.expiresAt===f.expiresAt&&x.gameId===f.gameId&&x.duration===f.duration);
  return [key(f),same?legacy?.follows[key(f)]??now:now];
 })),favoriteEnabledAt:!favoriteOn?legacy?.favoriteEnabledAt??now:old?.preferences.myTeams.enabled&&old.preferences.myTeams.kickoff?legacy!.favoriteEnabledAt:now,
 followingEnabledAt:!followingOn?legacy?.followingEnabledAt??now:old?.preferences.following?.enabled?legacy!.followingEnabledAt:now};
}
export function eligibleRecoveredKickoff(e:AlertEvent,s:SavedSubscription,now=Date.now()) {
 const cutoff=e.eligibilityAt;
 if(!Number.isFinite(cutoff)||!Number.isFinite(e.expiresAt)||now>=e.expiresAt!||cutoff!>e.observedAt)return false;
 const p=s.preferences,a=s.kickoffAccess??kickoffAccessTimes(s,p,s.updatedAt),gameId=/^game:(\d+):kickoff$/.exec(e.id)?.[1];
 const favorite=p.myTeams.enabled&&p.myTeams.kickoff&&a.favoriteEnabledAt<=cutoff!&&p.favorites.some(t=>e.teamIds.includes(t.id)&&a.favorites[t.id]<=cutoff!);
 const followed=p.following?.enabled&&a.followingEnabledAt<=cutoff!&&p.following.items.some(f=>a.follows[key(f)]<=cutoff!&&f.createdAt<=cutoff!&&f.expiresAt>now&&(f.duration==='game'?f.gameId===gameId:f.kind==='team'&&e.teamIds.includes(f.id)));
 return !!(favorite||followed);
}
