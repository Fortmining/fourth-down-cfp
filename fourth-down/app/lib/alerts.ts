import type { Poll, SourceId } from './rankings';
export type AlertType = 'kickoff' | 'final' | 'upset' | 'development' | 'ap' | 'coaches' | 'cfp';
export type TemporaryFollow={kind:'game'|'team';id:string;name:string;duration:'game'|'24h'|'7d';gameId?:string;createdAt:number;expiresAt:number};
export type AlertPreferences = {
 following?:{enabled:boolean;items:TemporaryFollow[]};
 version: 1; favorites: {id:string; name:string}[];
 myTeams: {enabled:boolean; kickoff:boolean; final:boolean};
 breaking: {enabled:boolean; upsets:boolean; developments:boolean; ap:boolean; coaches:boolean; cfp:boolean};
};
export function defaultAlertPreferences(): AlertPreferences {
 return {version:1,following:{enabled:false,items:[]},favorites:[],myTeams:{enabled:false,kickoff:false,final:false},breaking:{enabled:false,upsets:false,developments:false,ap:false,coaches:false,cfp:false}};
}
export function normalizePreferences(input: unknown): AlertPreferences {
 const p = (input && typeof input==='object' ? input : {}) as Partial<AlertPreferences>;
 const d=defaultAlertPreferences();const bool=(value:unknown)=>value===true;
 const ids=new Set<string>();
 d.favorites=(Array.isArray(p.favorites)?p.favorites:[]).filter(t=>t && typeof t.id==='string' && /^\d{1,12}$/.test(t.id) && typeof t.name==='string' && t.name.length>0 && t.name.length<=120 && !ids.has(t.id) && !!ids.add(t.id)).slice(0,20).map(t=>({id:t.id,name:t.name}));
 for(const key of ['enabled','kickoff','final'] as const)d.myTeams[key]=bool(p.myTeams?.[key]);
 for(const key of ['enabled','upsets','developments','ap','coaches','cfp'] as const)d.breaking[key]=bool(p.breaking?.[key]);
 const seen=new Set<string>();
 d.following={enabled:bool(p.following?.enabled),items:(Array.isArray(p.following?.items)?p.following.items:[]).filter(f=>{
  if(!f || !['game','team'].includes(f.kind) || !/^\d{1,12}$/.test(f.id) || typeof f.name!=='string' || !f.name.length || f.name.length>180 || !['game','24h','7d'].includes(f.duration) || !Number.isFinite(f.createdAt) || !Number.isFinite(f.expiresAt) || f.createdAt>f.expiresAt || f.expiresAt-f.createdAt>(f.duration==='game'?180: f.duration==='24h'?1:7)*86400000 || (f.duration==='game'&&!/^\d{1,12}$/.test(f.gameId||'')) || (f.kind==='game'&&(f.duration!=='game'||f.gameId!==f.id)))return false;
  const key=f.kind+':'+f.id;if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,40).map(f=>({kind:f.kind,id:f.id,name:f.name,duration:f.duration,gameId:f.gameId,createdAt:f.createdAt,expiresAt:f.expiresAt}))};
 return d;
}
export function hasAlerts(p:AlertPreferences) {
 return !!(p.following?.enabled && p.following.items.some(f=>f.expiresAt>Date.now())) || (p.myTeams.enabled && p.favorites.length>0 && (p.myTeams.kickoff||p.myTeams.final)) ||
 (p.breaking.enabled && (p.breaking.upsets||p.breaking.developments||p.breaking.ap||p.breaking.coaches||p.breaking.cfp));
}
export type AlertGame={id:string;date:string;name:string;status:string;providerStatus?:string;completed?:boolean;teams:{id:string;name:string;score?:string;rank?:number|null;winner?:boolean}[]};
export type AlertFeed={updatedAt:string;season:number|null;games:AlertGame[];polls:Poll[];warnings?:string[];scoreboardAvailable?:boolean;scoreboardDate?:string|null};
export type ConfirmedDevelopment={id:string;title:string;summary:string;sourceUrl:string;publishedAt:string;verifiedAt:string;confirmed:boolean};
export type AlertEvent={id:string;types:AlertType[];teamIds:string[];title:string;body:string;url:string;observedAt:number};
const trustedNewsHosts=new Set(['collegefootballplayoff.com','apnews.com','afca.com','espn.com','ncaa.com']);
export function verifiedDevelopment(n:ConfirmedDevelopment,now:number) {
 try { const u=new URL(n.sourceUrl); return n.confirmed===true && /^[a-z0-9-]{1,100}$/.test(n.id) &&
 n.title.length>0 && n.title.length<=120 && n.summary.length>0 && n.summary.length<=300 &&
 u.protocol==='https:' && trustedNewsHosts.has(u.hostname.replace(/^www\./,'')) &&
 Number.isFinite(Date.parse(n.publishedAt)) && Date.parse(n.publishedAt)<=Date.parse(n.verifiedAt) && Date.parse(n.verifiedAt)<=now && now-Date.parse(n.publishedAt)<=24*60*60_000;
 } catch {return false;}
}
export function confirmedFinal(g:AlertGame) {
 return g.status==='post' && g.completed===true && /^STATUS_FINAL(?:_OT)?$/.test(g.providerStatus||'') &&
 g.teams.length===2 && g.teams.every(t=>typeof t.score==='string' && /^\d{1,3}$/.test(t.score));
}
function edition(p:Poll) {return `${p.id}:${p.season}:${p.week??p.date?.slice(0,10)}`;}
function validPoll(p:Poll,season:number|null,now:number) {
 return !!season && p.season===season && p.status==='available' && !!p.date && Date.parse(p.date)<=now && now-Date.parse(p.date)<8*24*60*60_000 &&
 p.teams.length>=25 && new Set(p.teams.map(t=>t.teamId)).size===p.teams.length && p.teams.every(t=>Number.isInteger(t.rank)&&t.rank>=1&&t.rank<=25);
}
// Return the same gates used by delivery so diagnostics explain suppressed runs.
export function alertFeedGate(previous:AlertFeed|null,current:AlertFeed,now=Date.now()) {
 if(!previous)return 'initial-baseline';
 if(previous.season!==current.season)return 'season-changed';
 const currentAt=Date.parse(current.updatedAt),previousAt=Date.parse(previous.updatedAt);
 if(!Number.isFinite(currentAt)||!Number.isFinite(previousAt))return 'invalid-feed-time';
 if(now-currentAt>180_000)return 'current-feed-stale';
 if(currentAt>now+30_000)return 'current-feed-in-future';
 if(now-previousAt>300_000)return 'baseline-gap-over-five-minutes';
 if(currentAt<=previousAt)return 'feed-time-not-advanced';
 return 'ready';
}
export function kickoffDecision(previous:AlertFeed|null,current:AlertFeed,gameId:string,now=Date.now()) {
 const gate=alertFeedGate(previous,current,now);if(gate!=='ready')return gate;
 const g=current.games.find(g=>g.id===gameId),old=previous!.games.find(g=>g.id===gameId);
 if(!g)return 'game-missing-from-current-feed';
 if(!old)return 'game-missing-from-baseline';
 if(g.teams.length!==2)return 'invalid-team-count';
 if(old.status!=='pre')return 'baseline-not-scheduled';
 if(g.status!=='in')return 'current-not-live';
 if(!/^STATUS_(IN_PROGRESS|HALFTIME|END_PERIOD)$/.test(g.providerStatus||''))return 'provider-status-not-confirmed-live';
 if(!(Date.parse(g.date)<=now))return 'scheduled-time-in-future-or-invalid';
 return 'kickoff-detected';
}
// Conservative observed transitions only. Gaps >5 minutes establish a baseline.
// Intentionally retained pending real-event evidence; no historical catch-up.
export function deriveAlertEvents(previous:AlertFeed|null,current:AlertFeed,news:ConfirmedDevelopment[]=[],now=Date.now()):AlertEvent[] {
 if(alertFeedGate(previous,current,now)!=='ready')return [];
 const events:AlertEvent[]=[];const prior=new Map(previous!.games.map(g=>[g.id,g]));
 for(const g of current.games) {
  const old=prior.get(g.id);if(!old || g.teams.length!==2)continue;
  const teams=g.teams.map(t=>t.id);const url=`/game/${encodeURIComponent(g.id)}`;
  if(kickoffDecision(previous,current,g.id,now)==='kickoff-detected') {
   events.push({id:`game:${g.id}:kickoff`,types:['kickoff'],teamIds:teams,title:'Kickoff confirmed',body:g.name,url,observedAt:now});
  }
  if(old.status!=='post' && confirmedFinal(g)) {
   const [a,b]=g.teams;const winner=Number(a.score)>Number(b.score)?a:b;const loser=winner===a?b:a;
   const upset=Number(winner.score)>Number(loser.score) && winner.winner===true && loser.winner!==true && !!loser.rank && loser.rank<=10 &&
    (!winner.rank || winner.rank-loser.rank>=10);
   events.push({id:`game:${g.id}:final`,types:upset?['final','upset']:['final'],teamIds:teams,
    title:upset?'Confirmed major upset · Final':'Final score',body:`${a.name} ${a.score} · ${b.name} ${b.score}${upset?` — No. ${loser.rank} defeated`:''}`,url,observedAt:now});
  }
 }
 for(const p of current.polls) {
  const old=previous!.polls.find(q=>q.id===p.id);
  if(validPoll(p,current.season,now) && old && edition(old)!==edition(p) && (!old.date || Date.parse(p.date!)>Date.parse(old.date)))
   events.push({id:`poll:${edition(p)}`,types:[p.id as SourceId],teamIds:[],title:`New ${p.name} published`,body:`Published ${p.date!.slice(0,10)}${p.week?` · Week ${p.week}`:''}. View the actual published edition.`,url:'/#rankings-heading',observedAt:now});
 }
 for(const n of news)if(verifiedDevelopment(n,now))events.push({id:`development:${n.id}`,types:['development'],teamIds:[],title:n.title,body:n.summary,url:n.sourceUrl,observedAt:Date.parse(n.publishedAt)});
 return events;
}
export function selectedEvent(e:AlertEvent,p:AlertPreferences):boolean {
 const gameId=/^game:([^:]+):/.exec(e.id)?.[1];
 const followed=p.following?.enabled && (e.types.includes('kickoff')||e.types.includes('final')) && p.following.items.some(f=>
  f.createdAt<=e.observedAt && f.expiresAt>Math.max(e.observedAt,Date.now()) &&
  (f.duration==='game'?f.gameId===gameId:f.kind==='team'&&e.teamIds.includes(f.id)));

 const teamMatch=p.myTeams.enabled && e.teamIds.some(id=>p.favorites.some(t=>t.id===id));
 return !!(followed || (teamMatch && ((p.myTeams.kickoff&&e.types.includes('kickoff'))||(p.myTeams.final&&e.types.includes('final')))) ||
 (p.breaking.enabled && ((p.breaking.upsets&&e.types.includes('upset'))||(p.breaking.developments&&e.types.includes('development'))||
 (['ap','coaches','cfp'] as const).some(type=>p.breaking[type]&&e.types.includes(type)))));
}

// Apply only after processing final events so the final notification stays eligible.
export function remainingFollows(p:AlertPreferences,games:AlertGame[],now=Date.now()) {
 const finals=new Set(games.filter(confirmedFinal).map(g=>g.id));
 return (p.following?.items||[]).filter(f=>f.expiresAt>now && !(f.duration==='game'&&finals.has(f.gameId||'')));
}
