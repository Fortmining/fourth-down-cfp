import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultAlertPreferences,followChoices,selectedEvent} from '../app/lib/alerts.ts';
import {kickoffAccessTimes,eligibleRecoveredKickoff} from '../app/lib/kickoff-recovery.ts';
import {gameAccessTimes,extraGameEligible} from '../app/lib/game-alerts.ts';
import type {SavedSubscription} from '../app/lib/push-store.ts';
test('Florida–Georgia temporary follow receives selected kickoff/halftime with favorites and global extra choices off; later opt-in cannot replay',()=>{
 const now=Date.now(),savedAt=now-3600000,p=defaultAlertPreferences();
 p.following={enabled:true,items:[{kind:'game',id:'401856734',gameId:'401856734',name:'Florida at Georgia',duration:'game',createdAt:savedAt,expiresAt:now+3600000,alerts:{...followChoices(p),halftime:true}}]};
 const saved={preferences:p,updatedAt:savedAt,kickoffAccess:kickoffAccessTimes(null,p,savedAt),gameAccess:gameAccessTimes(null,p,savedAt)} as SavedSubscription;
 const base={teamIds:['61','57'],title:'Game',body:'Score',url:'/game/401856734',observedAt:now,eligibilityAt:now-1000,expiresAt:now+1000};
 const kickoff={...base,id:'game:401856734:kickoff',types:['kickoff' as const]},half={...base,id:'game:401856734:halftime',types:['halftime' as const]};
 assert.equal(p.gameAlerts!.following.halftime,false);assert.equal(p.favorites.length,0);
 assert.equal(selectedEvent(kickoff,p),true);assert.equal(eligibleRecoveredKickoff(kickoff,saved,now),true);
 assert.equal(selectedEvent(half,p),true);assert.equal(extraGameEligible(half,saved,'halftime',now),true);
 const late={...saved,kickoffAccess:kickoffAccessTimes(null,p,now),gameAccess:gameAccessTimes(null,p,now)};
 assert.equal(eligibleRecoveredKickoff(kickoff,late,now),false);assert.equal(extraGameEligible(half,late,'halftime',now),false);
 assert.equal(eligibleRecoveredKickoff(kickoff,saved,now+1001),false);assert.equal(extraGameEligible(half,saved,'halftime',now+1001),false);
});
