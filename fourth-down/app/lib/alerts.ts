import type { Ranked } from "./model";
import type {SourceFetchTrace} from './live-feed';
export {pulseTypes,defaultPulse} from './pulse-preferences.ts';
import {defaultPulse,normalizePulse,pulseTypes,type PulsePreferences,type PulseType} from './pulse-preferences.ts';
import type { Poll, SourceId } from './rankings';
export type AlertType = PulseType | 'halftime' | 'close' | 'upsetWatch' | 'confirmedUpset' | 'scoring' | 'kickoff' | 'final' | 'upset' | 'development' | 'ap' | 'coaches' | 'cfp';
export const followAlertTypes=['kickoff','halftime','close','scoring','final','upsetWatch','confirmedUpset'] as const;
export type FollowAlertType=typeof followAlertTypes[number];
export type FollowChoices=Record<FollowAlertType,boolean>;
export type TemporaryFollow={alerts?:FollowChoices;kind:'game'|'team';id:string;name:string;duration:'game'|'24h'|'7d';gameId?:string;createdAt:number;expiresAt:number};
export const extraGameTypes=['halftime','close','upsetWatch','confirmedUpset','scoring'] as const;
export type ExtraGameType=typeof extraGameTypes[number];
export type GameAlertChoices={favorites:Record<ExtraGameType,boolean>;following:Record<ExtraGameType,boolean>&{kickoff:boolean;final:boolean}};
export function defaultGameAlerts():GameAlertChoices {const off={halftime:false,close:false,upsetWatch:false,confirmedUpset:false,scoring:false};return {favorites:{...off},following:{...off,kickoff:true,final:true}};}
export type AlertPreferences = {
 pulse?:PulsePreferences;
 gameAlerts?:GameAlertChoices;
 following?:{enabled:boolean;items:TemporaryFollow[]};
 version: 1; favorites: {id:string; name:string}[];
 myTeams: {enabled:boolean; kickoff:boolean; final:boolean};
 breaking: {enabled:boolean; upsets:boolean; developments:boolean; ap:boolean; coaches:boolean; cfp:boolean};
};
export function defaultAlertPreferences(): AlertPreferences {
 return {version:1,pulse:defaultPulse(),gameAlerts:defaultGameAlerts(),following:{enabled:false,items:[]},favorites:[],myTeams:{enabled:false,kickoff:false,final:false},breaking:{enabled:false,upsets:false,developments:false,ap:false,coaches:false,cfp:false}};
}
export function normalizePreferences(input: unknown): AlertPreferences {
 const p = (input && typeof input==='object' ? input : {}) as Partial<AlertPreferences>;
 const d=defaultAlertPreferences();const bool=(value:unknown)=>value===true;
 d.pulse=normalizePulse(p.pulse);
 const ids=new Set<string>();
 d.favorites=(Array.isArray(p.favorites)?p.favorites:[]).filter(t=>t && typeof t.id==='string' && /^\d{1,12}$/.test(t.id) && typeof t.name==='string' && t.name.length>0 && t.name.length<=120 && !ids.has(t.id) && !!ids.add(t.id)).slice(0,20).map(t=>({id:t.id,name:t.name}));
 for(const key of ['enabled','kickoff','final'] as const)d.myTeams[key]=bool(p.myTeams?.[key]);
 for(const key of ['enabled','upsets','developments','ap','coaches','cfp'] as const)d.breaking[key]=bool(p.breaking?.[key]);
 d.gameAlerts=defaultGameAlerts();for(const group of ['favorites','following'] as const)for(const type of extraGameTypes)d.gameAlerts[group][type]=bool(p.gameAlerts?.[group]?.[type]);
 for(const type of ['kickoff','final'] as const)d.gameAlerts.following[type]=p.gameAlerts?.following?.[type]!==false;
 const seen=new Set<string>();
 d.following={enabled:bool(p.following?.enabled),items:(Array.isArray(p.following?.items)?p.following.items:[]).filter(f=>{
  if(!f || !['game','team'].includes(f.kind) || !/^\d{1,12}$/.test(f.id) || typeof f.name!=='string' || !f.name.length || f.name.length>180 || !['game','24h','7d'].includes(f.duration) || !Number.isFinite(f.createdAt) || !Number.isFinite(f.expiresAt) || f.createdAt>f.expiresAt || f.expiresAt-f.createdAt>(f.duration==='game'?180: f.duration==='24h'?1:7)*86400000 || (f.duration==='game'&&!/^\d{1,12}$/.test(f.gameId||'')) || (f.kind==='game'&&(f.duration!=='game'||f.gameId!==f.id)))return false;
  const key=f.kind+':'+f.id;if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,40).map(f=>({kind:f.kind,id:f.id,name:f.name,duration:f.duration,gameId:f.gameId,createdAt:f.createdAt,expiresAt:f.expiresAt,...(f.alerts?{alerts:Object.fromEntries(followAlertTypes.map(t=>[t,f.alerts?.[t]===true])) as FollowChoices}:{})}))};
 return d;
}
export function followChoices(p:AlertPreferences,f?:TemporaryFollow):FollowChoices {return Object.fromEntries(followAlertTypes.map(t=>[t,f?.alerts ? f.alerts[t]===true : (t==='kickoff'||t==='final'?p.gameAlerts?.following[t]!==false:p.gameAlerts?.following[t]===true)])) as FollowChoices;}
export function followsType(p:AlertPreferences,f:TemporaryFollow,t:string){return followAlertTypes.includes(t as FollowAlertType)&&followChoices(p,f)[t as FollowAlertType];}
export function hasAlerts(p:AlertPreferences) {
 return !!(p.pulse?.enabled&&(pulseTypes.some(t=>p.pulse?.categories[t])||Object.values(p.pulse.rankings).some(Boolean)))||!!(p.following?.enabled && p.following.items.some(f=>f.expiresAt>Date.now()&&followAlertTypes.some(t=>followsType(p,f,t)))) || (p.myTeams.enabled && p.favorites.length>0 && (p.myTeams.kickoff||p.myTeams.final||extraGameTypes.some(t=>p.gameAlerts?.favorites[t]))) ||
 (p.breaking.enabled && (p.breaking.upsets||p.breaking.developments||p.breaking.ap||p.breaking.coaches||p.breaking.cfp));
}
export type AlertGame={id:string;date:string;name:string;status:string;providerStatus?:string;completed?:boolean;period?:number;clock?:number;teams:{id:string;name:string;score?:string;rank?:number|null;winner?:boolean}[]};
export type AlertFeed={sourceFetch?:{scoreboard:SourceFetchTrace;rankings:SourceFetchTrace};updatedAt:string;season:number|null;games:AlertGame[];polls:Poll[];warnings?:string[];scoreboardAvailable?:boolean;scoreboardDate?:string|null};
export type ConfirmedDevelopment={id:string;title:string;summary:string;sourceUrl:string;publishedAt:string;verifiedAt:string;confirmed:boolean};
export type AlertEvent={id:string;types:AlertType[];teamIds:string[];title:string;body:string;url:string;observedAt:number;discovery?:{expiresAt:number};pulseContent?:{title:string;body:string;url:string;expiresAt?:number};eligibilityAt?:number;expiresAt?:number;cfpRanks?:Pick<Ranked,"teamId"|"rank"|"previous">[]};
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
   events.push({id:`poll:${edition(p)}`,types:[p.id as SourceId],teamIds:[],title:`New ${p.name} published`,body:`Published ${p.date!.slice(0,10)}${p.week?` · Week ${p.week}`:''}. View the actual published edition.`,url:`/?ranking=${p.id}#rankings-heading`,observedAt:now});
 }
 for(const n of news)if(verifiedDevelopment(n,now))events.push({id:`development:${n.id}`,types:['development'],teamIds:[],title:n.title,body:n.summary,url:n.sourceUrl,observedAt:Date.parse(n.publishedAt)});
 return events;
}
export function selectedEvent(e:AlertEvent,p:AlertPreferences):boolean {
 const gameId=/^game:([^:]+):/.exec(e.id)?.[1];
 const followed=p.following?.enabled && p.following.items.some(f=>e.types.some(t=>followsType(p,f,t)) &&
  f.createdAt<=(e.eligibilityAt??e.observedAt) && f.expiresAt>Math.max(e.observedAt,Date.now()) &&
  (f.duration==='game'?f.gameId===gameId:f.kind==='team'&&e.teamIds.includes(f.id)));

 const teamMatch=p.myTeams.…12117 tokens truncated…cap.id}:123`,String(Date.now()-600001));h.setFeed(snapshot([{...score,clock:270,teams:[{...score.teams[0],score:'52'},score.teams[1]]}],[],100));await run(h);assert.equal(h.sent.length,2);
});
test('AP tactical overlap and Confirmed Upset use single identities and receipts report only opted-in types',async()=>{
 const h=harness(),now=Date.now(),g={...match(),date:new Date(now-7200000).toISOString()};const poll={id:'ap',name:'AP Top 25',status:'available',season:2026,week:9,date:new Date(now-86400000).toISOString(),teams:Array.from({length:25},(_,i)=>({teamId:String(i+2),rank:i+1,name:`Team ${i+1}`}))};h.setFeed(snapshot([g],[poll],-1000));await run(h);
 const p=alerts.defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'123',gameId:'123',name:'One',duration:'game',createdAt:now-3600000,expiresAt:now+86400000}]};p.gameAlerts.following.final=false;p.gameAlerts.following.close=true;p.gameAlerts.following.upsetWatch=true;p.gameAlerts.following.confirmedUpset=true;await subscribe(h,p);
 const live={...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',period:4,clock:300};h.setFeed(snapshot([live],[poll],10));await run(h);assert.equal(h.sent.length,1);assert.deepEqual(h.sent[0].payload.types,['close','upsetWatch']);
 h.setFeed(snapshot([live],[poll],50));await run(h);assert.equal(h.sent.length,1);
 const final={...live,status:'post',providerStatus:'STATUS_FINAL',completed:true,clock:0,teams:[{...live.teams[0],score:'34',winner:true},{...live.teams[1],score:'31',winner:false}]};h.setFeed(snapshot([final],[poll],100));await run(h);assert.equal(h.sent.length,2);assert.equal(h.sent[1].payload.id,'game:123:final');assert.deepEqual(h.sent[1].payload.types,['confirmedUpset']);
 assert.equal((await h.receipt.POST(request({receipt:h.sent[1].payload.receipt,workerVersion:'0.7.0',platform:'ios',openClients:0}))).status,200);assert.ok(h.hashes.get('fd:v05:verified-types').has('confirmedUpset'));assert.equal(h.hashes.get('fd:v05:verified-types').has('final'),false);
});
test('kickoff and an initial score update cannot flood the same device in one check',async()=>{
 const h=harness(),now=Date.now(),g={...match(),teams:[{id:'1',name:'One',score:'0'},{id:'2',name:'Two',score:'0'}]};h.setFeed(snapshot([g],[],-1000));await run(h);
 const p=alerts.defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'123',gameId:'123',name:'One',duration:'game',createdAt:now-3600000,expiresAt:now+86400000}]};p.gameAlerts.following.scoring=true;await subscribe(h,p);
 h.setFeed(snapshot([{...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',period:1,clock:899.95,teams:[{...g.teams[0],score:'7'},g.teams[1]]}],[],10));await run(h);assert.equal(h.sent.length,1);assert.deepEqual(h.sent[0].payload.types,['kickoff']);
});

test('following-only atomic patch preserves permanent favorites, rankings, endpoint and activation times',async()=>{
 const h=harness();await run(h);const p=alerts.defaultAlertPreferences();p.favorites=[{id:'9',name:'Permanent'}];p.myTeams={enabled:true,kickoff:true,final:true};p.breaking={...p.breaking,enabled:true,ap:true};const cap=await subscribe(h,p);const before=JSON.parse(JSON.stringify(await h.store.loadSubscription(cap.id)));
 const following={enabled:true,items:[{kind:'game',id:'123',name:'Test',duration:'game',gameId:'123',createdAt:Date.now()-1000,expiresAt:Date.now()+86400000-1000,alerts:{kickoff:false,final:true,halftime:true,close:false,scoring:false,upsetWatch:false,confirmedUpset:false}}]};
 const result=await h.subscription.POST(request({action:'following',...cap,following,preferences:{favorites:[],breaking:{enabled:false}}}));assert.equal(result.status,200);const saved=JSON.parse(JSON.stringify(await h.store.loadSubscription(cap.id)));assert.deepEqual(JSON.parse(JSON.stringify(saved.preferences.following)),following);assert.deepEqual(saved.preferences.favorites,p.favorites);assert.deepEqual(saved.preferences.myTeams,p.myTeams);assert.deepEqual(saved.preferences.breaking,p.breaking);assert.deepEqual(saved.subscription,before.subscription);assert.equal(saved.typeSince.ap,before.typeSince.ap);
});
test('following patch rejects invalid capability and cannot silently report a rejected save as confirmed',async()=>{
 const h=harness();await run(h);const cap=await subscribe(h,alerts.defaultAlertPreferences());const before=await h.store.loadSubscription(cap.id);const result=await h.subscription.POST(request({action:'following',...cap,token:'a'.repeat(64),following:{enabled:true,items:[]}}));assert.equal(result.status,403);assert.deepEqual(await h.store.loadSubscription(cap.id),before);
});
test('concurrent settings changes reject the following patch instead of overwriting another save',async()=>{
 const h=harness();await run(h);const cap=await subscribe(h,alerts.defaultAlertPreferences());const original=h.store.redis;
 h.store.redis=async(...args)=>{if(args[0]==='EVAL'){const record=await h.store.loadSubscription(cap.id);record.preferences.breaking.ap=true;h.hashes.get(h.store.SUBS).set(cap.id,JSON.stringify(record));}return original(...args);};
 const result=await h.subscription.POST(request({action:'following',...cap,following:{enabled:true,items:[]}}));assert.equal(result.status,409);const saved=await h.store.loadSubscription(cap.id);assert.equal(saved.preferences.breaking.ap,true);assert.equal(saved.preferences.following.enabled,false);
});

const pulsePoll=(now=Date.now())=>({id:'ap',name:'AP Top 25',status:'available',season:2026,date:new Date(now-86400000).toISOString(),week:9,teams:Array.from({length:25},(_,i)=>({teamId:String(i+1),name:`Team ${i+1}`,rank:i+1}))});
function nationalPreferences(){const p=alerts.defaultAlertPreferences();p.pulse.enabled=true;p.pulse.preset='allIn';p.pulse.categories.pulseInteresting=true;return p;}
test('national discovery uses the existing delivery stream once, adds nothing to follows and retains private history',async()=>{
 const h=harness(),now=Date.now(),poll=pulsePoll(now),g={...match(),date:new Date(now-3600000).toISOString()};h.setFeed(snapshot([g],[poll],-1000));await run(h);const p=nationalPreferences(),cap=await subscribe(h,p);const live={...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',period:1,clock:800};h.setFeed(snapshot([live],[poll],10));await run(h);assert.equal(h.sent.length,1);assert.deepEqual(h.sent[0].payload.types,['pulseInteresting']);assert.match(h.sent[0].payload.url,/\/game\/123\?follow=1/);assert.ok(h.sent[0].payload.expiresAt<=Date.now()+120000);assert.equal((await h.store.loadSubscription(cap.id)).preferences.following.items.length,0);
 h.setFeed(snapshot([{...live,clock:700}],[poll],50));await run(h);assert.equal(h.sent.length,1);const inbox=await(await h.inbox.POST(request({...cap,action:'list'}))).json();assert.equal(inbox.entries.length,1);assert.equal(inbox.entries[0].id,h.sent[0].payload.id);assert.equal(JSON.stringify(inbox).includes(endpoint.endpoint),false);assert.equal(JSON.stringify(inbox).includes(cap.token),false);
});
test('national and existing tactical notifications coalesce without changing the followed-game payload',async()=>{
 const h=harness(),now=Date.now(),poll=pulsePoll(now),g={...match(),date:new Date(now-7200000).toISOString()};h.setFeed(snapshot([g],[poll],-1000));await run(h);
 const national=nationalPreferences();national.pulse.categories.pulseInteresting=false;national.pulse.categories.pulseClose=true;const cap=await subscribe(h,national,'national');
 const followed=structuredClone(national);followed.following={enabled:true,items:[{kind:'game',id:'123',name:'Game',duration:'game',gameId:'123',createdAt:now-3600000,expiresAt:now+86400000}]};followed.gameAlerts.following.close=true;await subscribe(h,followed,'followed');
 h.setFeed(snapshot([{...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',period:4,clock:240}],[poll],10));await run(h);assert.equal(h.sent.length,2);const a=h.sent.find(x=>x.s.endpoint.endsWith('national')).payload,b=h.sent.find(x=>x.s.endpoint.endsWith('followed')).payload;assert.deepEqual(a.types,['pulseClose']);assert.match(a.url,/follow=1/);assert.deepEqual(b.types,['close']);assert.equal(b.url,'/game/123');assert.equal(b.body.includes('Tap to'),false);assert.equal(a.id,b.id);
 assert.ok(h.values.has(`fd:v08:pulse-budget:${cap.id}`));
});
test('late-created follows still suppress national invitations and cannot receive retroactive kickoff',async()=>{
 const h=harness(),now=Date.now(),poll=pulsePoll(now),g={...match(),date:new Date(now-3600000).toISOString()};h.setFeed(snapshot([g],[poll],-1000));await run(h);const p=nationalPreferences();p.following={enabled:false,items:[{kind:'game',id:'123',gameId:'123',name:'Game',duration:'game',createdAt:now+1,expiresAt:now+86400000}]};await subscribe(h,p);h.setFeed(snapshot([{...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',period:1,clock:800}],[poll],10));await run(h);assert.equal(h.sent.length,0);
});
test('national budget does not mute an independently opted-in favorite and existing subscribers stay opted out',async()=>{
 const h=harness(),now=Date.now(),poll=pulsePoll(now),g={...match(),date:new Date(now-7200000).toISOString()};h.setFeed(snapshot([g],[poll],-1000));await run(h);
 const p=nationalPreferences();p.pulse.categories.pulseClose=true;p.favorites=[{id:'1',name:'Favorite'}];p.myTeams.enabled=true;p.gameAlerts.favorites.close=true;const cap=await subscribe(h,p);h.values.set(`fd:v08:pulse-budget:${cap.id}`,JSON.stringify(Array.from({length:12},()=>({at:Date.now(),types:['pulseClose']}))));await subscribe(h,alerts.defaultAlertPreferences(),'legacy');
 h.setFeed(snapshot([{...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',period:4,clock:240}],[poll],10));await run(h);assert.equal(h.sent.length,1);assert.deepEqual(h.sent[0].payload.types,['close']);
});
test('national confirmed major upset requires verified final and frozen AP ranking and merges overlapping legacy upset',async()=>{
 const h=harness(),now=Date.now(),poll=pulsePoll(now);poll.teams=Array.from({length:25},(_,i)=>({teamId:String(i+2),rank:i+1,name:`Team ${i+2}`}));const g={...match(),date:new Date(now-7200000).toISOString()};h.setFeed(snapshot([g],[poll],-1000));await run(h);const p=alerts.defaultAlertPreferences();p.pulse.enabled=true;p.pulse.categories.pulseFinal=true;p.breaking.enabled=true;p.breaking.upsets=true;await subscribe(h,p);h.setFeed(snapshot([{...g,status:'in',providerStatus:'STATUS_IN_PROGRESS',period:4,clock:120}],[poll],10));await run(h);assert.equal(h.sent.length,0);const final={...g,status:'post',providerStatus:'STATUS_FINAL',completed:true,period:4,clock:0,teams:[{...g.teams[0],score:'34',winner:true},{...g.teams[1],score:'31',winner:false}]};h.setFeed(snapshot([final],[poll],50));await run(h);assert.equal(h.sent.length,1);assert.ok(h.sent[0].payload.types.includes('pulseFinal'));assert.ok(h.sent[0].payload.types.includes('upset'));assert.equal(h.sent[0].payload.id,'game:123:final');
});
test('notification history capability isolates devices; dismiss and clear do not reset push claims',async()=>{
 const h=harness();await run(h);const p=alerts.defaultAlertPreferences();p.breaking.enabled=true;p.breaking.ap=true;const a=await subscribe(h,p,'a'),b=await subscribe(h,p,'b');const entry={id:'poll:ap:2026:9',title:'AP published',body:'Actual edition',url:'/?ranking=ap#rankings-heading',types:['ap'],generatedAt:Date.now(),recordedAt:Date.now(),delivery:'generated-display-unverified'};h.lists.set(`fd:v08:inbox:${a.id}`,[JSON.stringify(entry)]);h.values.set(`fd:v05:sent:${a.id}:${entry.id}`,'claimed');
 assert.equal((await h.inbox.POST(request({id:a.id,token:b.token,action:'list'}))).status,403);assert.equal((await(await h.inbox.POST(request({...b,action:'list'}))).json()).entries.length,0);assert.equal((await(await h.inbox.POST(request({...a,action:'list'}))).json()).entries.length,1);assert.equal((await h.inbox.POST(request({...a,action:'dismiss',eventId:entry.id}))).status,200);assert.equal(h.lists.get(`fd:v08:inbox:${a.id}`).length,0);h.lists.set(`fd:v08:inbox:${a.id}`,[JSON.stringify(entry)]);await h.inbox.POST(request({...a,action:'clear'}));assert.ok(h.values.has(`fd:v05:sent:${a.id}:${entry.id}`));assert.equal(h.lists.has(`fd:v08:inbox:${a.id}`),false);
});
test('history rejects cross-origin access and untrusted links without revealing capabilities',async()=>{
 const h=harness();await run(h);const a=await subscribe(h,alerts.defaultAlertPreferences());assert.equal((await h.inbox.POST(request({...a,action:'list'},'https://evil.test'))).status,403);h.lists.set(`fd:v08:inbox:${a.id}`,[JSON.stringify({id:'evil',title:'Evil',body:'Bad',url:'https://evil.test/',types:[],generatedAt:Date.now(),recordedAt:Date.now()})]);const data=await(await h.inbox.POST(request({...a,action:'list'}))).json();assert.equal(data.entries.length,0);
});
test('outlook snapshots require two checks and hold same-edition corrections without sending model alerts',async()=>{
 const h=harness(),now=Date.now(),poll=pulsePoll(now);h.setFeed(snapshot([],[poll],-1000));await run(h);assert.equal(h.values.has('fd:v08:outlook'),false);h.setFeed(snapshot([],[poll],10));await run(h);assert.ok(h.values.has('fd:v08:outlook'));const stable=JSON.parse(h.values.get('fd:v08:outlook'));assert.equal(stable.snapshot.predictive,false);assert.equal(stable.comparison.notificationsSupported,false);[poll.teams[0].rank,poll.teams[1].rank]=[2,1];h.setFeed(snapshot([],[poll],50));await run(h);h.setFeed(snapshot([],[poll],100));await run(h);assert.deepEqual(JSON.parse(h.values.get('fd:v08:outlook')).snapshot.teams,stable.snapshot.teams);assert.equal(h.sent.length,0);
});
test('explicit v0.8.1 Balanced save persists all three game choices and independent rankings without replacing the endpoint',async()=>{
 const h=harness();await run(h);const p=alerts.defaultAlertPreferences();p.pulse.enabled=true;p.pulse.categories.pulseFinal=true;p.pulse.categories.pulseClose=true;p.pulse.rankings={ap:true,coaches:false,cfp:true};p.favorites=[{id:'9',name:'Permanent'}];p.myTeams={enabled:true,kickoff:true,final:true};const cap=await subscribe(h,p);const before=JSON.parse(JSON.stringify(await h.store.loadSubscription(cap.id)));const next={...p,pulse:pulsePreset('balanced',p.pulse)};
 const response=await h.subscription.POST(request({action:'update',...cap,preferences:next}));assert.equal(response.status,200);const saved=JSON.parse(JSON.stringify(await h.store.loadSubscription(cap.id)));assert.equal(saved.preferences.pulse.categories.pulseUpset,true);assert.equal(saved.preferences.pulse.categories.pulseFinal,true);assert.equal(saved.preferences.pulse.categories.pulseClose,true);assert.equal(saved.preferences.pulse.categories.pulseInteresting,false);assert.equal(saved.preferences.pulse.gameSelectionMade,true);assert.deepEqual(saved.preferences.pulse.rankings,p.pulse.rankings);assert.deepEqual(saved.preferences.favorites,p.favorites);assert.deepEqual(saved.subscription,before.subscription);assert.equal(saved.tokenHash,before.tokenHash);assert.equal(saved.typeSince.kickoff,before.typeSince.kickoff);
});

test('Tennessee permanent-favorite pipeline sends each opted-in game type without temporary subscriptions',async()=>{
 for(const type of ['kickoff','scoring','halftime','close','final']){
  const h=harness(),now=Date.now(),teams=[{id:'2633',name:'Tennessee Volunteers',score:'0'},{id:'2579',name:'South Carolina',score:'0'}];
  const base={id:'401856731',name:'Tennessee at South Carolina',date:new Date(now-(type==='kickoff'?60000:3600000)).toISOString(),status:type==='kickoff'?'pre':'in',providerStatus:type==='kickoff'?'STATUS_SCHEDULED':'STATUS_IN_PROGRESS',completed:false,period:type==='close'?3:2,clock:500,teams};
  h.setFeed(snapshot([base],[],-1000));await run(h);const p=alerts.defaultAlertPreferences();p.favorites=[{id:'2633',name:'Tennessee Volunteers'}];p.myTeams={enabled:true,kickoff:true,final:true};p.gameAlerts.favorites.scoring=true;p.gameAlerts.favorites.halftime=true;p.gameAlerts.favorites.close=true;const cap=await subscribe(h,p);
  const record=await h.store.loadSubscription(cap.id);record.kickoffAccess.favorites['2633']=now-86400000;record.kickoffAccess.favoriteEnabledAt=now-86400000;h.hashes.get(h.store.SUBS).set(cap.id,JSON.stringify(record));
  const live={...base,status:'in',providerStatus:'STATUS_IN_PROGRESS',period:type==='kickoff'?1:type==='close'?4:2,clock:type==='kickoff'?899.95:type==='close'?299:480};
  const next=type==='final'?{...live,status:'post',providerStatus:'STATUS_FINAL',completed:true}:type==='halftime'?{...live,providerStatus:'STATUS_HALFTIME',clock:0}:type==='scoring'?{...live,teams:[{...teams[0],score:'7'},teams[1]]}:live;
  h.setFeed(snapshot([next],[],10));assert.equal((await run(h)).status,200,type);assert.equal(h.sent.length,1,type);assert.deepEqual(h.sent[0].payload.types,[type]);assert.equal(h.sent[0].options.urgency,type==='kickoff'?'high':'normal');assert.ok(h.sent[0].options.TTL>0&&h.sent[0].options.TTL<=300);
  const saved=await h.store.loadSubscription(cap.id);assert.equal(saved.preferences.following.enabled,false);assert.equal(saved.preferences.following.items.length,0);
  const attempt=h.lists.get(`fd:v083:game-delivery:${cap.id}:401856731`).map(JSON.parse).find(e=>e.kind==='provider-send-attempt');assert.deepEqual(attempt.favoriteTeamIds,['2633']);assert.equal(attempt.myTeams.enabled,true);
 }
});
test('worker arrival and suppression reports never count as confirmed browser display and preserve legacy one-time receipts',async()=>{
 const h=harness();h.setFeed(snapshot([match('in')],[],-60000));await run(h);const p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};const cap=await subscribe(h,p);h.setFeed(snapshot([match('post')],[],10));await run(h);const receipt=h.sent[0].payload.receipt;
 assert.equal((await h.receipt.POST(request({receipt,outcome:'arbitrary'}))).status,400);
 assert.equal((await h.receipt.POST(request({receipt,outcome:'received',receivedAt:Date.now(),workerVersion:'0.8.3',platform:'ios',openClients:0}))).status,200);
 assert.ok(h.values.has('fd:v05:receipt:'+h.store.tokenHash(receipt)));assert.equal(h.hashes.get('fd:v05:verified-types')?.has('final')||false,false);
 assert.equal((await h.receipt.POST(request({receipt,outcome:'expired',scope:{favoriteMatch:true,secret:'PRIVATE'},platform:'ios'}))).status,200);assert.equal(h.hashes.get('fd:v05:verified-types')?.has('final')||false,false);
 const log=h.lists.get(`fd:v083:game-delivery:${cap.id}:123`).map(JSON.parse);assert.ok(log.some(e=>e.kind==='worker-received'));assert.ok(log.some(e=>e.kind==='worker-suppressed'&&e.outcome==='expired'));assert.equal(JSON.stringify(log).includes('PRIVATE'),false);
 assert.equal((await h.receipt.POST(request({receipt,outcome:'displayed'}))).status,410);
});
test('game-specific delivery evidence survives unrelated game traffic and stays bounded without capability snapshots',async()=>{
 const h=harness();await h.store.appendDeliveryAudit('device',{kind:'provider-accepted',eventId:'game:123:kickoff',following:{secret:'PRIVATE'},settingsSavedAt:1});
 for(let i=0;i<205;i++)await h.store.appendDeliveryAudit('device',{kind:'event-filtered',eventId:'game:999:score:'+i,favoriteTeamIds:[]});
 assert.equal(h.lists.get('fd:v06:audit:device').length,200);const evidence=h.lists.get('fd:v083:game-delivery:device:123');assert.equal(evidence.length,1);assert.equal(evidence[0].includes('PRIVATE'),false);assert.equal(h.lists.has('fd:v083:game-delivery:device:999'),false);
});

test('fresh-source fetch timing survives through scheduled checks and selected final send evidence',async()=>{
 const h=harness();h.setFeed(snapshot([match('in')],[],-60000));await run(h);const p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};const cap=await subscribe(h,p);
 const trace={policy:'no-store',requestStartedAt:new Date(Date.now()-100).toISOString(),responseReceivedAt:new Date().toISOString(),bodyParsedAt:new Date().toISOString(),responseDate:new Date().toUTCString(),ageSeconds:0,ok:true};h.setFeed({...snapshot([match('post')],[],10),sourceFetch:{scoreboard:trace,rankings:trace}});await run(h);assert.equal(h.sent.length,1);
 const observed=h.lists.get('fd:v06:scheduler').map(JSON.parse).find(x=>x.kind==='feed-observed');assert.equal(observed.sourceFetch.scoreboard.policy,'no-store');assert.equal(observed.sourceFetch.scoreboard.bodyParsedAt,trace.bodyParsedAt);
 const event=h.lists.get(`fd:v083:game-delivery:${cap.id}:123`).map(JSON.parse).find(x=>x.kind==='provider-send-attempt');assert.equal(event.scoreboardSource.bodyParsedAt,trace.bodyParsedAt);assert.equal(event.scoreboardSource.ageSeconds,0);
});

test('desktop push endpoint families use isolated capabilities and deleting desktop keeps iPhone preferences and subscription',async()=>{
 const h=harness();await h.dispatcher.GET(new Request('https://fourth-down-cfp.vercel.app/api/alerts/dispatch',{headers:{authorization:'Bearer secret'}}));
 // Establish scheduler health without relying on a real production invocation.
 h.values.set('fd:v05:heartbeat',String(Date.now()));
 const p=alerts.defaultAlertPreferences();p.favorites=[{id:'2633',name:'Tennessee Volunteers'}];p.myTeams={enabled:true,kickoff:true,final:true};
 const phonesub={...endpoint,endpoint:'https://web.push.apple.com/iphone-fixture'};const phone=await(await h.subscription.POST(request({action:'create',subscription:phonesub,preferences:p}))).json();assert.ok(phone.id);
 for(const host of ['fcm.googleapis.com','updates.push.services.mozilla.com','wns2.notify.windows.com','web.push.apple.com'])assert.equal(h.store.validPushSubscription({...endpoint,endpoint:'https://'+host+'/desktop-fixture'}),true);
 const desktop=await(await h.subscription.POST(request({action:'create',subscription:endpoint,preferences:p}))).json();assert.ok(desktop.id);assert.notEqual(desktop.id,phone.id);assert.notEqual(desktop.token,phone.token);
 assert.equal((await h.subscription.POST(request({action:'create',subscription:endpoint,preferences:p}))).status,409);
 assert.equal((await h.subscription.POST(request({action:'delete',id:phone.id,token:desktop.token}))).status,403);
 assert.equal((await h.subscription.POST(request({action:'delete',id:desktop.id,token:desktop.token}))).status,200);assert.equal(JSON.stringify((await h.store.loadSubscription(phone.id)).preferences.favorites),JSON.stringify(p.favorites));
});

test('optional confirmed resume publishing runs after favorite final delivery and failure cannot break notifications',async()=>{
 let h,calls=0;h=harness({releaseEnabled:true,resumePublisher:async(batch,previous,startedAt)=>{calls++;assert.equal(batch.controlled,true);assert.equal(typeof startedAt,'number');if(calls===2){assert.equal(h.sent.length,1);throw Error('Isolated resume timeout');}return {status:'accepted',lastAcceptedAt:Date.now()};}});
 const date=new Date(Date.now()-3600000).toISOString(),game={id:'resume-safe',name:'Favorite at Rival',date,status:'in',providerStatus:'STATUS_IN_PROGRESS',completed:false,teams:[{id:'1',name:'Favorite',score:'7'},{id:'2',name:'Rival',score:'0'}]};
 h.setFeed({season:2026,updatedAt:new Date().toISOString(),games:[game],polls:[]});assert.equal((await run(h)).status,200);
 const preferences=alerts.defaultAlertPreferences();preferences.favorites=[{id:'1',name:'Favorite'}];preferences.myTeams={enabled:true,kickoff:true,final:true};await h.subscription.POST(request({action:'create',subscription:endpoint,preferences}));
 h.setFeed({season:2026,updatedAt:new Date().toISOString(),games:[{...game,status:'post',providerStatus:'STATUS_FINAL',completed:true,teams:[{...game.teams[0],score:'28',winner:true},game.teams[1]]}],polls:[]});
 assert.equal((await run(h)).status,200);assert.equal(calls,2);assert.equal(h.sent.length,1);assert.equal(h.sent[0].payload.id,'game:resume-safe:final');assert.equal(JSON.parse(h.values.get('fd:v05:last-check')).resumeSync.status,'failed');
});

test('provider acceptance preserves its actual status without capturing response headers, payload credentials or endpoint',async()=>{
 const h=harness(),now=Date.now(),game={id:'900000002',name:'One at Two',date:new Date(now-300000).toISOString(),status:'in',providerStatus:'STATUS_IN_PROGRESS',completed:false,period:4,clock:30,teams:[{id:'1',name:'One',score:'14'},{id:'2',name:'Two',score:'7'}]};
 h.setFeed({season:2026,updatedAt:new Date(now-60000).toISOString(),games:[game],polls:[]});await run(h);
 const p=alerts.defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:true};assert.equal((await h.subscription.POST(request({action:'create',subscription:endpoint,preferences:p}))).status,200);
 h.setFeed({season:2026,updatedAt:new Date(Date.now()+10).toISOString(),games:[{...game,status:'post',providerStatus:'STATUS_FINAL',completed:true,clock:0,teams:[{...game.teams[0],winner:true},game.teams[1]]}],polls:[]});assert.equal((await run(h)).status,200);
 const audits=[...h.lists.values()].flat().map(x=>JSON.parse(x)).filter(x=>x.kind==='provider-accepted');assert.ok(audits.length>0);assert.ok(audits.some(e=>e.status===201));assert.ok(audits.every(e=>!('subscription' in e)&&!('headers' in e)&&!('receipt' in e)));
});
