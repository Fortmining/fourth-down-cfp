import {outlookSnapshot} from './outlook-snapshots.ts';
import type {AlertEvent,AlertFeed,AlertGame,AlertPreferences} from './alerts';
import {lateSituation} from './game-alerts.ts';
import type {GameAlertMemory} from './game-alerts';
import {pulseDailyLimit,type PulsePreferences} from './pulse-preferences.ts';
export type PulseBudget={at:number;types:string[];gameId?:string}[];
export function pulseBudgetAllows(types:string[],gameId:string|undefined,p:PulsePreferences,budget:PulseBudget,now:number){
 const day=now-86400000;
 if(budget.filter(x=>x.at>=day).length>=pulseDailyLimit(p.preset))return false;
 const final=types.includes('pulseFinal');const invitation=types.some(t=>['pulseUpset','pulseClose','pulseInteresting'].includes(t));
 if(budget.some(x=>now-x.at<(final?120000:600000)))return false;
 if(invitation&&gameId&&budget.some(x=>x.gameId===gameId&&x.types.some(t=>['pulseUpset','pulseClose','pulseInteresting'].includes(t))&&now-x.at<6*3600000))return false;
 return !types.some(t=>budget.some(x=>x.types.includes(t)&&now-x.at<(t==='pulseFinal'?900000:t==='pulseUpset'?900000:1800000)));
}
export function liveInvitation(g:AlertGame,now:number){
 const elapsed=now-Date.parse(g.date),minimum=g.period!>=5?3600000:g.period===4?2400000:g.period===3?1500000:g.period===2?600000:0;
 return elapsed>=minimum&& g.status==='in'&&g.completed!==true&&/^STATUS_(IN_PROGRESS|END_PERIOD)$/.test(g.providerStatus||'')&&Number.isInteger(g.period)&&g.period!>=1&&g.period!<=20&&Number.isFinite(g.clock)&&g.clock!>=0&&g.clock!<=900&&Number.isFinite(Date.parse(g.date))&&Date.parse(g.date)<=now&&now-Date.parse(g.date)<8*3600000&&g.teams.length===2&&g.teams.every(t=>typeof t.score==='string'&&/^\d{1,3}$/.test(t.score)&&Number(t.score)<=199)&&(g.period!<4||g.period!>4||g.clock!>=90);
}
export function derivePulse(feed:AlertFeed,memory:GameAlertMemory|null,existing:AlertEvent[],now=Date.now()):AlertEvent[]{
 const at=Date.parse(feed.updatedAt);if(!outlookSnapshot(feed,now)||!memory||memory.season!==feed.season||!Number.isFinite(at)||now-at>60000||at>now+30000||feed.scoreboardAvailable===false)return [];
 const events:AlertEvent[]=[];
 for(const g of feed.games){
  const m=memory.games[g.id];if(!m?.ranking||now-Date.parse(m.ranking.edition)>8*86400000||Date.parse(m.ranking.edition)>now||m.teamIds.join()!==g.teams.map(t=>t.id).sort().join())continue;
  if(m.terminal&&g.status!=='post')continue;
  const ranks=m.ranking.ranks,ranked=g.teams.map(t=>ranks[t.id]);
  const suffix=`Tap to choose alerts and follow. AP edition ${m.ranking.edition.slice(0,10)}.`;
  const body=g.teams.map(t=>`${ranks[t.id]?`No. ${ranks[t.id]} `:''}${t.name} ${t.score}`).join(' · ');
  const offer=(event:AlertEvent,type:'pulseUpset'|'pulseClose'|'pulseInteresting'|'pulseFinal')=>{
   const live=type!=='pulseFinal';const expiry=Math.min(event.expiresAt??now+120000,now+(g.period===4?Math.max(1,g.clock!-60)*1000:120000),now+120000);
   events.push({...event,types:[type],title:type==='pulseUpset'?'Upset Watch':type==='pulseClose'?'Close Game Discovery':type==='pulseFinal'?'Confirmed Major Upset':'Interesting Live Game',body:live?`${body} · ${g.period!>=5?'Overtime':`Q${g.period} ${Math.floor(g.clock!/60)}:${String(Math.floor(g.clock!%60)).padStart(2,'0')}`} · ${suffix}`:event.body,url:live?`/game/${g.id}?follow=1&alertAt=${now}&inviteUntil=${expiry}`:`/game/${g.id}`,expiresAt:live?expiry:event.expiresAt,discovery:live?{expiresAt:expiry}:undefined});
  };
  const gameEvents=existing.filter(e=>e.id.startsWith(`game:${g.id}:`));
  // Re-evaluate a still-live situation after a missed delivery window; keep its existing phase identity.
  if(liveInvitation(g,now)&&m.lastProgressAt&&now-m.lastProgressAt<=360000){const phase=g.period!>=5?'overtime':'fourth',id=`game:${g.id}:late:${phase}`,situation=lateSituation(g,m.ranking);if(situation.late&&!gameEvents.some(e=>e.id===id)){const types:AlertEvent['types']=[];if(situation.close)types.push('close');if(situation.threat)types.push('upsetWatch');if(types.length)gameEvents.push({id,types,teamIds:g.teams.map(t=>t.id),title:'',body,url:`/game/${g.id}`,observedAt:now,expiresAt:now+120000});}}
  for(const e of gameEvents){
   if(e.types.includes('confirmedUpset')&&g.status==='post'&&g.completed===true&&Number.isFinite(Date.parse(g.date))&&Date.parse(g.date)<=now&&now-Date.parse(g.date)<8*3600000)offer(e,'pulseFinal');
   if(!liveInvitation(g,now)||!m.lastProgressAt||now-m.lastProgressAt>360000)continue;
   if(e.types.includes('upsetWatch'))offer(e,'pulseUpset');
   if(e.types.includes('close')&&ranked.some(r=>r&&r<=25))offer(e,'pulseClose');
  }
  // The same durable game memory supplies the ranking and live witness; no parallel sports feed.
  if(m.lastProgressAt&&now-m.lastProgressAt<=360000&&liveInvitation(g,now)&&g.period!<=3&&(g.period===1||Math.abs(Number(g.teams[0].score)-Number(g.teams[1].score))<=16)&&!(g.period===1&&g.clock===900)&&ranked.every(r=>r&&r<=25)&&ranked.some(r=>r<=15))offer({id:`game:${g.id}:discovery`,types:[],teamIds:g.teams.map(t=>t.id),title:'',body,url:`/game/${g.id}`,observedAt:now,eligibilityAt:now},'pulseInteresting');
 }
 return events;
}
export function nationalSelected(e:AlertEvent,p:AlertPreferences){return e.types.some(t=>t.startsWith('pulse')||(['ap','coaches','cfp'].includes(t)&&p.pulse?.enabled&&p.pulse.rankings[t as 'ap'|'coaches'|'cfp']));}
