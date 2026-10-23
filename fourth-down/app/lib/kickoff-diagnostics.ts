import {kickoffDecision,selectedEvent,normalizePreferences,type AlertFeed,type AlertEvent,type AlertGame} from './alerts';
import {eligibleRecoveredKickoff} from './kickoff-recovery';
import type {SavedSubscription} from './push-store';

// Fixed codes and normalized preferences only; never include endpoints or capabilities.
export function notificationEligibility(event:AlertEvent,saved:SavedSubscription) {
 const decisions=event.types.map(type=>({type,selected:type==='kickoff'&&event.eligibilityAt!==undefined?eligibleRecoveredKickoff(event,saved):selectedEvent({...event,types:[type]},saved.preferences),activeSince:saved.typeSince[type],activationPassed:type==='kickoff'&&event.eligibilityAt!==undefined?eligibleRecoveredKickoff(event,saved):event.observedAt>=saved.typeSince[type]}));
 return {types:decisions.filter(d=>d.selected&&d.activationPassed).map(d=>d.type),decisions};
}
const state=(g:AlertGame|undefined)=>g?{status:g.status,providerStatus:g.providerStatus??null,scheduledAt:g.date,completed:g.completed===true,teamIds:g.teams.map(t=>t.id)}:null;
export function kickoffObservations(previous:AlertFeed|null,current:AlertFeed,saved:SavedSubscription,now:number) {
 const p=saved.preferences;
 const all=new Map([...(previous?.games||[]),...current.games].map(g=>[g.id,g]));
 const ids=new Set([...all.values()].filter(g=>g.teams.some(t=>p.favorites.some(f=>f.id===t.id)||(p.following?.items||[]).some(f=>f.kind==='team'&&f.id===t.id))).map(g=>g.id));
 for(const f of p.following?.items||[])if(f.gameId)ids.add(f.gameId);
 return [...ids].flatMap(gameId=>{
  const old=previous?.games.find(g=>g.id===gameId),g=current.games.find(g=>g.id===gameId),known=g||old;
  const changed=old?.status!==g?.status||old?.providerStatus!==g?.providerStatus;
  // Capture every poll around kickoff, plus changes and missing-game observations.
  if(known&&!changed&&Math.abs(now-Date.parse(known.date))>6*3600_000)return [];
  const teamIds=(known?.teams||[]).map(t=>t.id);
  const matches=(p.following?.items||[]).filter(f=>f.duration==='game'?f.gameId===gameId:f.kind==='team'&&teamIds.includes(f.id));
  const event:AlertEvent={id:`game:${gameId}:kickoff`,types:['kickoff'],teamIds,title:'',body:'',url:`/game/${gameId}`,observedAt:now};
  return [{gameId,decision:kickoffDecision(previous,current,gameId,now),previous:state(old),current:state(g),settingsSavedAt:saved.updatedAt,
   eligibility:notificationEligibility(event,saved),followingEnabled:p.following?.enabled===true,
   matchingFollows:matches.map(f=>({kind:f.kind,id:f.id,gameId:f.gameId,duration:f.duration,createdAt:f.createdAt,expiresAt:f.expiresAt,createdBeforeObservation:f.createdAt<=now,unexpired:f.expiresAt>now})),
   favoriteTeamIds:p.favorites.filter(f=>teamIds.includes(f.id)).map(f=>f.id),myTeams:p.myTeams}];
 });
}
// Used for both client sync reports and inspection of locally retained attempts.
export const followingSyncStages=['started','no-push-controls','no-active-subscription','worker-save-failed','settings-save-required','server-save-failed','server-saved'] as const;
export function sanitizeSyncAttempt(input:unknown) {
 const d=input as {stage?:unknown;at?:unknown;following?:unknown;pendingSettings?:unknown;httpStatus?:unknown};
 if(!d||!followingSyncStages.includes(d.stage as typeof followingSyncStages[number])||!Number.isFinite(d.at))return null;
 return {stage:d.stage as string,at:d.at as number,pendingSettings:d.pendingSettings===true,httpStatus:Number.isInteger(d.httpStatus)&&Number(d.httpStatus)>=100&&Number(d.httpStatus)<=599?Number(d.httpStatus):null,following:normalizePreferences({following:d.following}).following};
}

// Independent of subscriptions: capture transitions even if a local follow never
// reached the server. Near kickoff, unchanged states also establish each poll.
export function kickoffFeedObservations(previous:AlertFeed|null,current:AlertFeed,now:number) {
 const all=new Map([...(previous?.games||[]),...current.games].map(g=>[g.id,g]));
 return [...all.values()].flatMap(game=>{
  const old=previous?.games.find(g=>g.id===game.id),g=current.games.find(g=>g.id===game.id);
  const changed=old?.status!==g?.status||old?.providerStatus!==g?.providerStatus;
  if(!changed&&Math.abs(now-Date.parse(game.date))>30*60_000)return [];
  return [{gameId:game.id,previous:state(old),current:state(g),decision:kickoffDecision(previous,current,game.id,now)}];
 });
}
