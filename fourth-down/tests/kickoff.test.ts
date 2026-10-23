import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveAlertEvents,kickoffDecision,defaultAlertPreferences,selectedEvent,type AlertFeed,type AlertGame} from '../app/lib/alerts.ts';
const now=Date.now(),kickoff=now-60_000;
const game=(status='pre',extra:Partial<AlertGame>={}):AlertGame=>({id:'401869845',name:'JMU at App State',date:new Date(kickoff).toISOString(),status,providerStatus:status==='in'?'STATUS_IN_PROGRESS':'STATUS_SCHEDULED',teams:[{id:'256',name:'JMU'},{id:'2026',name:'App State'}],...extra});
const feed=(g:AlertGame[]=[],offset=0):AlertFeed=>({season:2026,updatedAt:new Date(now+offset).toISOString(),games:g,polls:[]});
const before=()=>feed([game()],-240_000);
test('four-minute scheduled-to-live check routes a temporary game followed three hours before kickoff',()=>{
 const previous=before(),current=feed([game('in')]);
 assert.equal(kickoffDecision(previous,current,'401869845',now),'kickoff-detected');
 const events=deriveAlertEvents(previous,current,[],now);assert.equal(events.length,1);
 const p=defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'401869845',gameId:'401869845',name:'JMU at App State',duration:'game',createdAt:now-3*3600_000,expiresAt:now+86400_000}]};
 assert.equal(selectedEvent(events[0],p),true);assert.equal(p.favorites.length,0);
 p.following.enabled=false;assert.equal(selectedEvent(events[0],p),false);
 p.following.enabled=true;p.following.items[0].createdAt=now+1;assert.equal(selectedEvent(events[0],p),false);
});
test('poll jitter within five minutes still detects kickoff; skipped four-minute poll does not replay',()=>{
 const current=feed([game('in')]);
 for(const age of [240_000,299_999,300_000])assert.equal(deriveAlertEvents(feed([game()],-age),current,[],now).length,1,String(age));
 for(const age of [300_001,480_000]){
  assert.equal(kickoffDecision(feed([game()],-age),current,'401869845',now),'baseline-gap-over-five-minutes');
  assert.equal(deriveAlertEvents(feed([game()],-age),current,[],now).length,0);
 }
});
test('delayed ESPN update detects kickoff while still scheduled; halftime is accepted as explicit live confirmation',()=>{
 const delayed=game('pre',{date:new Date(now-90*60_000).toISOString(),providerStatus:'STATUS_DELAYED'});
 assert.equal(deriveAlertEvents(feed([delayed],-240_000),feed([delayed]),[],now).length,0);
 for(const status of ['STATUS_IN_PROGRESS','STATUS_HALFTIME','STATUS_END_PERIOD']){
  const current=feed([game('in',{date:delayed.date,providerStatus:status})]);
  assert.equal(deriveAlertEvents(feed([delayed],-240_000),current,[],now).length,1,status);
 }
});
test('missing feed update can erase the pregame comparison; next live observation explains missing baseline',()=>{
 const missing=feed([],-120_000);assert.equal(kickoffDecision(before(),missing,'401869845',now),'game-missing-from-current-feed');
 const live=feed([game('in')]);assert.equal(kickoffDecision(missing,live,'401869845',now),'game-missing-from-baseline');
 assert.equal(deriveAlertEvents(missing,live,[],now).length,0);
});
test('stale, future, repeated, invalid and initial feed snapshots explain suppression',()=>{
 const cases:[AlertFeed|null,AlertFeed,string][]=[
  [null,feed([game('in')]),'initial-baseline'],
  [before(),feed([game('in')],-180_001),'current-feed-stale'],
  [before(),feed([game('in')],30_001),'current-feed-in-future'],
  [feed([game()],-60_000),feed([game('in')],-60_000),'feed-time-not-advanced'],
  [before(),{...feed([game('in')]),updatedAt:'invalid'},'invalid-feed-time'],
  [before(),{...feed([game('in')]),season:2027},'season-changed']
 ];
 for(const [previous,current,reason] of cases){assert.equal(kickoffDecision(previous,current,'401869845',now),reason);assert.equal(deriveAlertEvents(previous,current,[],now).length,0);}
});
test('unknown, postponed, canceled and already-live states cannot manufacture kickoff',()=>{
 const previous=before();
 for(const status of ['STATUS_DELAYED','STATUS_POSTPONED','STATUS_CANCELED','STATUS_UNKNOWN']){
  const current=feed([game('in',{providerStatus:status})]);assert.equal(kickoffDecision(previous,current,'401869845',now),'provider-status-not-confirmed-live');assert.equal(deriveAlertEvents(previous,current,[],now).length,0);
 }
 const live=feed([game('in')]);assert.equal(kickoffDecision(feed([game('in')],-240_000),live,'401869845',now),'baseline-not-scheduled');
 assert.equal(deriveAlertEvents(feed([game('in')],-240_000),live,[],now).length,0);
});
test('live state arriving before the scheduled timestamp is suppressed and remains diagnosable on next poll',()=>{
 const early=game('in',{date:new Date(now+60_000).toISOString()});const current=feed([early]);
 assert.equal(kickoffDecision(before(),current,'401869845',now),'scheduled-time-in-future-or-invalid');
 assert.equal(deriveAlertEvents(before(),current,[],now).length,0);
 const later=feed([early],240_000);assert.equal(kickoffDecision(current,later,'401869845',now+240_000),'baseline-not-scheduled');
});
