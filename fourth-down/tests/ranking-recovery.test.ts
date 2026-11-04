import {test} from 'node:test';import assert from 'node:assert/strict';
import {recoverRankings} from '../app/lib/ranking-recovery.ts';import type {AlertFeed} from '../app/lib/alerts.ts';
const now=Date.now();
function feed(week:number,at:number):AlertFeed{return {season:2026,updatedAt:new Date(at).toISOString(),games:[],polls:[{id:'ap',name:'AP Top 25',url:'https://apnews.com',message:'Published',status:'available',season:2026,week,date:new Date(now-(week===8?7:1)*86400000).toISOString(),teams:Array.from({length:25},(_,i)=>({teamId:String(i+1),rank:i+1,name:'Team',record:'',conference:'',previous:null}))}]};}
test('missed poll recovers only a genuine new ranking edition with pre-gap opt-in cutoff',()=>{const previous=feed(8,now-480000),baseline=recoverRankings(null,previous,null,now-480000);assert.equal(baseline.events.length,0);const current=feed(9,now),r=recoverRankings(previous,current,baseline.state,now);assert.equal(r.events.length,1);assert.equal(r.events[0].id,'poll:ap:2026:9');assert.equal(r.events[0].eligibilityAt,now-480000);assert.equal(r.events[0].url,'/?ranking=ap#rankings-heading');});
test('temporary source disappearance and same-edition recovery never manufacture new rankings',()=>{const previous=feed(8,now-480000),baseline=recoverRankings(null,previous,null,now-480000);const missing={...feed(8,now-240000),polls:[]};const gap=recoverRankings(previous,missing,baseline.state,now-240000);const same=recoverRankings(missing,feed(8,now),gap.state,now);assert.equal(same.events.length,0);const changed=recoverRankings(missing,feed(9,now),gap.state,now);assert.equal(changed.events.length,1);});
test('long gaps, initial baselines, repeated feeds and stale inputs do not cause historical ranking bursts',()=>{assert.equal(recoverRankings(null,feed(9,now),null,now).events.length,0);const old=feed(8,now-7200000),baseline=recoverRankings(null,old,null,now-7200000);assert.equal(recoverRankings(old,feed(9,now),baseline.state,now).events.length,0);const f=feed(8,now),initial=recoverRankings(null,f,null,now);assert.equal(recoverRankings(f,f,initial.state,now).events.length,0);});
test('same-edition corrections do not alert and pending event replay is bounded and keeps one identity',()=>{const prev=feed(8,now-240000),current=feed(9,now),a=recoverRankings(prev,current,null,now);const repeat=feed(9,now+240000),b=recoverRankings(current,repeat,a.state,now+240000);assert.equal(b.events[0].id,a.events[0].id);assert.equal(b.events[0].observedAt,now);const late=recoverRankings(repeat,feed(9,now+480000),b.state,now+480000);assert.equal(late.events.length,0);});

import {personalizeCfpEdition} from '../app/lib/ranking-recovery.ts';
import {defaultAlertPreferences,selectedEvent} from '../app/lib/alerts.ts';

function cfpFeed(date: string, at: number, previous: number | null = null): AlertFeed {
 const f=feed(10,at);
 return {...f,polls:[{...f.polls[0],id:'cfp',name:'CFP committee rankings',
  date,providerUpdatedAt:new Date(at-60000).toISOString(),
  teams:f.polls[0].teams.map(row=>({...row,previous}))}]};
}

test('first fresh CFP edition alerts, retries with the same identity, and survives restart',()=>{
 const at=Date.parse('2027-11-03T01:00Z');
 const first=cfpFeed('2027-11-02T08:00Z',at);
 const result=recoverRankings(null,first,null,at);
 assert.equal(result.events.length,1);
 const later=at+240000;
 const refreshed={...first,updatedAt:new Date(later).toISOString()};
 const replay=recoverRankings(first,refreshed,JSON.parse(JSON.stringify(result.state)),later);
 assert.equal(replay.events[0].id,result.events[0].id);
 assert.equal(replay.events[0].observedAt,at);
 assert.equal(recoverRankings(refreshed,refreshed,replay.state,later).events.length,0);
 const expired=at+480000;
 assert.equal(recoverRankings(first,{...first,updatedAt:new Date(expired).toISOString()},replay.state,expired).events.length,0);
 assert.equal(recoverRankings(first,refreshed,null,later).events.length,0);
});

test('subsequent edition includes unchanged favorite rank; general and favorite share one edition ID',()=>{
 const at=Date.parse('2026-11-11T02:10Z');
 const first=cfpFeed('2026-11-03T08:00Z',at-604800000);
 const next=cfpFeed('2026-11-10T08:00Z',at,13);
 const event=recoverRankings(first,next,null,at).events[0];
 const prefs=defaultAlertPreferences();
 assert.equal(selectedEvent(event,prefs),false);
 prefs.breaking.enabled=true;
 prefs.breaking.cfp=true;
 assert.equal(selectedEvent(event,prefs),true);
 assert.equal(personalizeCfpEdition(event,prefs),event);
 prefs.favorites=[{id:'13',name:'Tennessee'}];
 const personalized=personalizeCfpEdition(event,prefs);
 assert.equal(personalized.id,event.id);
 assert.match(personalized.body,/Tennessee No\. 13 \(unchanged\)/);
});

test('historical first edition, incomplete Top 25, and same-date refresh cannot mint an alert',()=>{
 const at=Date.parse('2026-11-04T03:23Z');
 const first=cfpFeed('2026-11-03T08:00Z',at);
 assert.equal(recoverRankings(null,first,null,at).events.length,0);
 const nextAt=Date.parse('2026-11-11T02:10Z');
 const next=cfpFeed('2026-11-10T08:00Z',nextAt);
 const invalid=structuredClone(next);
 invalid.polls[0].teams.pop();
 assert.equal(recoverRankings(first,invalid,null,nextAt).events.length,0);
 const refresh=cfpFeed('2026-11-10T09:00Z',nextAt+60000);
 assert.equal(recoverRankings(next,refresh,null,nextAt+60000).events.length,0);
});

test('provider update metadata cannot suppress a complete new CFP edition',()=>{
 const at=Date.parse('2026-11-11T04:45Z');
 for(const metadata of [undefined,'invalid','2026-11-10T08:00Z','2026-11-11T05:00Z']){
  const current=cfpFeed('2026-11-10T08:00Z',at);
  current.polls[0].providerUpdatedAt=metadata;
  const result=recoverRankings(null,current,null,at);
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].eligibilityAt,at);
 }
 const stale=cfpFeed('2026-11-08T08:00Z',at);
 assert.equal(recoverRankings(null,stale,null,at).events.length,0);
 const prior=cfpFeed('2026-11-03T08:00Z',at-604800000);
 assert.equal(recoverRankings(prior,stale,null,at).events.length,1);
});
