import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultAlertPreferences,followAlertTypes,followChoices,normalizePreferences,selectedEvent,hasAlerts} from '../app/lib/alerts.ts';
import {kickoffAccessTimes,eligibleRecoveredKickoff} from '../app/lib/kickoff-recovery.ts';
import {extraGameEligible,gameAccessTimes} from '../app/lib/game-alerts.ts';
import type {SavedSubscription} from '../app/lib/push-store.ts';
const now=Date.now();
const follow={kind:'game' as const,id:'123',name:'Game',duration:'game' as const,gameId:'123',createdAt:now-3600000,expiresAt:now+3600000};
const event={id:'game:123:kickoff',types:['kickoff' as const],teamIds:['1','2'],title:'',body:'',url:'/game/123',observedAt:now,eligibilityAt:now-10000,expiresAt:now+10000};
test('per-follow choices normalize strictly and override defaults only for that follow',()=>{
 const p=defaultAlertPreferences();p.following={enabled:true,items:[{...follow,alerts:{...followChoices(p),kickoff:false,halftime:true}}]};
 const q=normalizePreferences(p);assert.deepEqual(q.following,p.following);assert.equal(selectedEvent(event,q),false);assert.equal(selectedEvent({...event,types:['halftime']},q),true);assert.equal(selectedEvent({...event,id:'game:456:halftime',types:['halftime']},q),false);
 assert.equal(selectedEvent({...event,types:['final']},q),true);assert.equal(hasAlerts(q),true);q.following!.enabled=false;assert.equal(selectedEvent({...event,types:['halftime']},q),false);
});
test('legacy follows inherit v0.7 defaults and explicit all-off stays muted',()=>{
 const p=defaultAlertPreferences();p.following={enabled:true,items:[follow]};assert.equal(selectedEvent(event,p),true);
 p.following.items[0]={...follow,alerts:Object.fromEntries(followAlertTypes.map(t=>[t,false])) as ReturnType<typeof followChoices>};assert.equal(hasAlerts(p),false);assert.equal(selectedEvent(event,p),false);
 p.favorites=[{id:'1',name:'Permanent'}];p.myTeams={enabled:true,kickoff:true,final:true};assert.equal(selectedEvent(event,p),true);
});
test('editing halftime does not reset old kickoff eligibility; newly enabled kickoff cannot catch up',()=>{
 const p=defaultAlertPreferences();p.following={enabled:true,items:[{...follow,alerts:followChoices(p)}]};
 const old={preferences:p,updatedAt:now-3600000,kickoffAccess:kickoffAccessTimes(null,p,now-3600000)} as SavedSubscription;
 const q=structuredClone(p);q.following!.items[0].alerts!.halftime=true;const access=kickoffAccessTimes(old,q,now);assert.equal(access.followTypes!['game:123:kickoff'],now-3600000);assert.equal(access.followTypes!['game:123:halftime'],now);
 assert.equal(eligibleRecoveredKickoff(event,{...old,preferences:q,kickoffAccess:access}),true);
 old.preferences.following!.items[0].alerts!.kickoff=false;q.following!.items[0].alerts!.kickoff=true;assert.equal(eligibleRecoveredKickoff(event,{...old,preferences:q,kickoffAccess:kickoffAccessTimes(old,q,now)}),false);
});
test('newly enabled per-follow halftime cannot replay an earlier event and does not alter favorites',()=>{
 const p=defaultAlertPreferences();p.following={enabled:true,items:[{...follow,alerts:followChoices(p)}]};const old={preferences:p,updatedAt:now-3600000,kickoffAccess:kickoffAccessTimes(null,p,now-3600000),gameAccess:gameAccessTimes(null,p,now-3600000)} as SavedSubscription;
 const q=structuredClone(p);q.following!.items[0].alerts!.halftime=true;const updated={...old,preferences:q,kickoffAccess:kickoffAccessTimes(old,q,now),gameAccess:gameAccessTimes(old,q,now)};
 assert.equal(extraGameEligible({...event,types:['halftime']},updated,'halftime'),false);assert.equal(extraGameEligible({...event,types:['halftime'],eligibilityAt:now+1},updated,'halftime',now+2),true);assert.deepEqual(q.favorites,p.favorites);assert.deepEqual(q.breaking,p.breaking);
});
