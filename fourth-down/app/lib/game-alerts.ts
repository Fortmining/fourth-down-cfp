import {followsType} from './alerts.ts';
import type {AlertEvent,AlertFeed,AlertGame,AlertPreferences,ExtraGameType} from './alerts.ts';
import type {SavedSubscription} from './push-store';
type Ranking={source:'AP';edition:string;ranks:Record<string,number>};
type GameMemory={teamIds:string[];lastSeenAt:number;phase:string;terminal?:boolean;halftimeWitness?:boolean;scores:number[];ranking:Ranking|null;events:Record<string,number>};
export type GameAlertMemory={season:number|null;lastFeedAt:number;games:Record<string,GameMemory>};
const validScores=(g:AlertGame)=>g.teams.length===2&&g.teams.every(t=>typeof t.score==='string'&&/^\d{1,3}$/.test(t.score)&&Number(t.score)<=199);
const ids=(g:AlertGame)=>g.teams.map(t=>t.id).sort();
function ap(feed:AlertFeed,now:number):Ranking|null {
 const p=feed.polls.find(p=>p.id==='ap'&&p.status==='available'&&p.season===feed.season&&p.date&&Date.parse(p.date)<=now&&now-Date.parse(p.date)<8*86400000);
 if(!p||p.teams.length<25||new Set(p.teams.map(t=>t.teamId)).size!==p.teams.length||new Set(p.teams.map(t=>t.rank)).size!==p.teams.length||!p.teams.every(t=>Number.isInteger(t.rank)&&t.rank>=1&&t.rank<=25&&/^\d+$/.test(t.teamId)))return null;
 return {source:'AP',edition:p.date!,ranks:Object.fromEntries(p.teams.map(t=>[t.teamId,t.rank]))};
}
function matchup(g:AlertGame,r:Ranking|null) {
 if(!r)return null;
 for(const strong of g.teams){const rank=r.ranks[strong.id];const weak=g.teams.find(t=>t.id!==strong.id)!;const weakRank=r.ranks[weak.id];if(rank&&rank<=10&&(!weakRank||weakRank-rank>=10))return {strong,weak,rank};}
 return null;
}
export function deriveGameAlerts(previous:AlertFeed|null,current:AlertFeed,input:unknown,now=Date.now()) {
 const old=input as GameAlertMemory|null;
 const state:GameAlertMemory=old?.season===current.season&&old.games?{season:old.season,lastFeedAt:old.lastFeedAt,games:{...old.games}}:{season:current.season,lastFeedAt:0,games:{}};
 for(const [id,g] of Object.entries(state.games))if(now-g.lastSeenAt>2*86400000)delete state.games[id];
 const at=Date.parse(current.updatedAt),events:AlertEvent[]=[];
 if(!Number.isInteger(current.season)||!Number.isFinite(at)||now-at>90000||at>now+30000||at<=state.lastFeedAt||current.scoreboardAvailable===false)return {state,events,gate:'feed-unavailable-or-not-fresh'};
 const ranking=ap(current,now);
 for(const g of current.games){
  if(!/^\d{1,12}$/.test(g.id)||g.teams.length!==2||new Set(ids(g)).size!==2||!g.teams.every(t=>/^\d{1,12}$/.test(t.id)))continue;
  const saved=state.games[g.id],prior=previous?.season===current.season?previous.games.find(x=>x.id===g.id):undefined;
  if(saved&&JSON.stringify(saved.teamIds)!==JSON.stringify(ids(g)))continue;
  const m:GameMemory=saved?{...saved,events:{...saved.events}}:{teamIds:ids(g),lastSeenAt:now,phase:prior?.status||g.status,scores:prior&&validScores(prior)?prior.teams.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(t=>Number(t.score)):[],ranking:prior&&prior.status!=='post'?ap(previous!,now):null,events:{}};
  if(g.status==='pre')m.ranking=ranking;
  if(!m.ranking&&g.status==='in'&&g.period===1)m.ranking=ranking;
  m.lastSeenAt=now;state.games[g.id]=m;
  if(g.status==='pre'||(g.status==='in'&&g.providerStatus!=='STATUS_HALFTIME')||(prior&&prior.status!=='post'&&prior.providerStatus!=='STATUS_HALFTIME'))m.halftimeWitness=true;
  const currentScores=g.teams.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(t=>Number(t.score));
  const valid=validScores(g),time=Date.parse(g.date);
  const live=g.status==='in'&&g.completed!==true&&/^STATUS_(IN_PROGRESS|END_PERIOD|HALFTIME)$/.test(g.providerStatus||'')&&Number.isInteger(g.period)&&g.period!>=1&&g.period!<=20&&Number.isFinite(g.clock)&&g.clock!>=0&&g.clock!<=900&&Number.isFinite(time)&&time<=now&&now-time<8*3600000&&m.phase!=='post'&&!m.terminal;
  const scoreBody=g.teams.map(t=>`${t.name} ${t.score}`).join(' · ');
  const offer=(suffix:string,types:AlertEvent['types'],title:string,body:string,eligibilityAt?:number)=>{
   const id=`game:${g.id}:${suffix}`;
   if(suffix.startsWith('score:')&&Object.keys(m.events).length>=60&&m.events[id]===undefined)return;
   if(m.events[id]===undefined)m.events[id]=now;
   if(suffix.startsWith('late:'))for(const type of types){const typeKey=`${id}:${type}`;if(m.events[typeKey]===undefined){m.events[typeKey]=now;m.events[id]=now;}}
   const seen=m.events[id];if(now-seen>=300000)return;
   events.push({id,types,teamIds:g.teams.map(t=>t.id),title,body,url:`/game/${g.id}`,observedAt:seen,eligibilityAt:eligibilityAt??seen,expiresAt:seen+300000});
  };
  const contest=matchup(g,m.ranking);
  if(live&&valid){
   if(g.providerStatus==='STATUS_HALFTIME'&&g.period===2&&g.clock===0&&m.halftimeWitness) {offer('halftime',['halftime'],'Halftime score',scoreBody);}
   const late=(g.period===4&&g.clock!<=300)||g.period!>=5;
   if(late){const close=g.period!>=5||Math.abs(currentScores[0]-currentScores[1])<=8;const threat=contest&&Number(contest.strong.score)-Number(contest.weak.score)<=8;
    const types:AlertEvent['types']=[];if(close)types.push('close');if(threat)types.push('upsetWatch');
    if(types.length){const phase=g.period!>=5?'overtime':'fourth';const clock=g.period!>=5?`OT ${g.period!-4}`:`Q4 ${Math.floor(g.clock!/60)}:${String(Math.floor(g.clock!%60)).padStart(2,'0')}`;
     offer(`late:${phase}`,types,threat?'Upset Watch':'Close game',`${scoreBody} · ${clock}${threat?` · AP No. ${contest!.rank} threatened (edition ${m.ranking!.edition.slice(0,10)})`:''}`);}
   }
   if(m.scores.length===2&&currentScores.every((v,i)=>v>=m.scores[i])&&currentScores.some((v,i)=>v>m.scores[i]))offer(`score:${g.teams.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(t=>`${t.id}-${t.score}`).join(':')}`,['scoring'],'Scoring update',scoreBody,m.lastSeenAt);
  }
  const final=g.status==='post'&&g.completed===true&&/^STATUS_FINAL(?:_OT)?$/.test(g.providerStatus||'')&&valid;
  if(final&&!m.terminal&&contest&&Number(contest.weak.score)>Number(contest.strong.score)&&contest.weak.winner===true&&contest.strong.winner!==true&&(saved||prior)&&m.phase!=='post')offer('final',['confirmedUpset'],'Confirmed Upset · Final',`${scoreBody} · AP No. ${contest.rank} defeated (edition ${m.ranking!.edition.slice(0,10)})`);
  if(valid)m.scores=m.scores.length===2?currentScores.map((v,i)=>Math.max(v,m.scores[i])):currentScores;
  if(g.status==='post'||g.completed===true||/^STATUS_CANCEL/.test(g.providerStatus||''))m.terminal=true;
  m.phase=g.status;
 }
 state.lastFeedAt=at;
 if(Object.keys(state.games).length>2000)return {state:{...state,games:{}},events:[],gate:'capacity-exceeded'};
 return {state,events,gate:'ready'};
}
export function extraGameEligible(e:AlertEvent,s:SavedSubscription,type:ExtraGameType,now=Date.now()) {
 if(!s.preferences.gameAlerts||e.expiresAt===undefined||now>=e.expiresAt)return false;
 const p=s.preferences,cutoff=e.eligibilityAt??e.observedAt,access=s.kickoffAccess;
 const since=(group:string)=>s.gameAccess?.[`${group}:${type}`]??s.updatedAt;
 const favorite=since('favorites')<=cutoff&&p.myTeams.enabled&&p.gameAlerts!.favorites[type]&&p.favorites.some(t=>e.teamIds.includes(t.id)&&(access?.favorites[t.id]??s.updatedAt)<=cutoff);
 const gameId=/^game:(\d+):/.exec(e.id)?.[1];
 const follow=since('following')<=cutoff&&p.following?.enabled&&p.following.items.some(f=>followsType(p,f,type)&&(s.kickoffAccess?.followTypes?.[`${f.kind}:${f.id}:${type}`]??access?.follows[`${f.kind}:${f.id}`]??s.updatedAt)<=cutoff&&f.createdAt<=cutoff&&(access?.follows[`${f.kind}:${f.id}`]??s.updatedAt)<=cutoff&&f.expiresAt>now&&(f.duration==='game'?f.gameId===gameId:f.kind==='team'&&e.teamIds.includes(f.id)));
 return !!(favorite||follow);
}
export function gameAlertRate(e:AlertEvent) {return e.types.includes('scoring')?600000:e.types.some(t=>t==='close'||t==='upsetWatch')?300000:0;}

export function gameAccessTimes(old:SavedSubscription|null,p:AlertPreferences,now:number) {
 const result:Record<string,number>={};
 for(const group of ['favorites','following'] as const)for(const type of ['halftime','close','upsetWatch','confirmedUpset','scoring'] as const){
  const on=group==='favorites'?!!p.gameAlerts?.favorites[type]&&p.myTeams.enabled:!!p.following?.enabled&&p.following.items.some(f=>followsType(p,f,type));
  const before=group==='favorites'?!!old?.preferences.gameAlerts?.favorites[type]&&old.preferences.myTeams.enabled:!!old?.preferences.following?.enabled&&old.preferences.following.items.some(f=>followsType(old.preferences,f,type));
  result[`${group}:${type}`]=on&&before?old?.gameAccess?.[`${group}:${type}`]??old!.updatedAt:now;
 }
 return result;
}
