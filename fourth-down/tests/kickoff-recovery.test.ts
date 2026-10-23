import {test} from 'node:test';import assert from 'node:assert/strict';
import {recoverKickoffs,eligibleRecoveredKickoff,kickoffAccessTimes,KICKOFF_WINDOW_MS} from '../app/lib/kickoff-recovery.ts';
import {defaultAlertPreferences,type AlertFeed,type AlertGame} from '../app/lib/alerts.ts';
import type {SavedSubscription} from '../app/lib/push-store.ts';
const start=Date.now(),game=(status='pre',extra:Partial<AlertGame>={}):AlertGame=>({id:'123',name:'One at Two',date:new Date(start).toISOString(),status,providerStatus:status==='in'?'STATUS_IN_PROGRESS':'STATUS_SCHEDULED',period:status==='in'?1:0,clock:status==='in'?840:0,teams:[{id:'1',name:'One',score:'0'},{id:'2',name:'Two',score:'0'}],...extra});
const feed=(at:number,games:AlertGame[]):AlertFeed=>({season:2026,updatedAt:new Date(at).toISOString(),games,polls:[],scoreboardAvailable:true});
const initial=()=>recoverKickoffs(null,feed(start-3600000,[game()]),null,start-3600000).memory;
test('durable witness recovers a skipped poll and missing intermediate games with the original event identity',()=>{
 const missing=recoverKickoffs(null,feed(start+120000,[]),initial(),start+120000);
 const recovered=recoverKickoffs(feed(start+120000,[]),feed(start+480000,[game('in')]),missing.memory,start+480000);
 assert.equal(recovered.events.length,1);assert.equal(recovered.events[0].id,'game:123:kickoff');assert.equal(recovered.events[0].eligibilityAt,start);assert.equal(recovered.events[0].expiresAt,start+KICKOFF_WINDOW_MS);
});
test('unsupported intermediate ESPN state and premature live status do not consume recovery',()=>{
 for(const intermediate of [game('in',{providerStatus:'STATUS_UNKNOWN'}),game('in',{clock:900}),game('in',{clock:0,period:0})]){
  const first=recoverKickoffs(null,feed(start-1000,[intermediate]),initial(),start-1000);assert.equal(first.events.length,0);
  const next=recoverKickoffs(null,feed(start+240000,[game('in')]),first.memory,start+240000);assert.equal(next.events.length,1);assert.equal(next.events[0].eligibilityAt,start-1000);
 }
});
test('rejects stale/future feeds, expired windows, unknown clocks, halftime, overtime and invalid or shifted timestamps',()=>{
 for(const [now,g,offset] of [[start+720000,game('in'),0],[start+240000,game('in',{period:2}),0],[start+240000,game('in',{period:5}),0],[start+240000,game('in',{clock:undefined}),0],[start+240000,game('in',{clock:900}),0],[start+240000,game('in',{date:'invalid'}),0],[start+240000,game('in',{date:new Date(start+240000).toISOString()}),0],[start+240000,game('in'),-90001],[start+240000,game('in'),30001]] as [number,AlertGame,number][]){const result=recoverKickoffs(null,feed(now+offset,[g]),initial(),now);assert.equal(result.events.length,0,JSON.stringify([now,g,offset]));}
 assert.equal(recoverKickoffs(null,feed(start+1000,[game('in',{clock:100})]),initial(),start+1000).decisions['123'].reason,'clock-ahead-of-wall-time');
});
test('does not invent a witness on cold start or reuse identity across teams, seasons or final-to-live regressions',()=>{
 assert.equal(recoverKickoffs(null,feed(start+240000,[game('in')]),null,start+240000).events.length,0);
 const changed=game('in',{teams:[{id:'3',name:'Other'},{id:'2',name:'Two'}]});assert.equal(recoverKickoffs(null,feed(start+240000,[changed]),initial(),start+240000).events.length,0);
 assert.equal(recoverKickoffs(null,{...feed(start+240000,[game('in')]),season:2027},initial(),start+240000).events.length,0);
 const ended=recoverKickoffs(null,feed(start+100000,[game('post',{providerStatus:'STATUS_FINAL',completed:true})]),initial(),start+100000);
 assert.equal(recoverKickoffs(null,feed(start+240000,[game('in')]),ended.memory,start+240000).events.length,0);
});
function subscription(at:number):SavedSubscription{const p=defaultAlertPreferences();p.following={enabled:true,items:[{kind:'game',id:'123',gameId:'123',name:'One',duration:'game',createdAt:start-3600000,expiresAt:start+86400000}]};return {id:'a',tokenHash:'test',subscription:{endpoint:'test',keys:{auth:'',p256dh:''}},preferences:p,updatedAt:at,typeSince:{halftime:at,close:at,upsetWatch:at,confirmedUpset:at,scoring:at,kickoff:at,final:at,ap:at,coaches:at,cfp:at,upset:at,development:at},kickoffAccess:kickoffAccessTimes(null,p,at)};}
test('authoritative server timing rejects late-created, backdated, late-enabled follows and new favorites',()=>{
 const e=recoverKickoffs(null,feed(start+480000,[game('in')]),initial(),start+480000).events[0];
 assert.equal(eligibleRecoveredKickoff(e,subscription(start-3600000),start+480000),true);
 const late=subscription(start+1000);assert.equal(eligibleRecoveredKickoff(e,late,start+480000),false,'client backdating cannot override server save');
 const edited=subscription(start-3600000);edited.preferences.following!.items[0].createdAt=start+1;assert.equal(eligibleRecoveredKickoff(e,edited,start+480000),false);
 const disabled=subscription(start-3600000);disabled.preferences.following!.enabled=false;const on=structuredClone(disabled.preferences);on.following!.enabled=true;disabled.kickoffAccess=kickoffAccessTimes(disabled,on,start+1);disabled.preferences=on;assert.equal(eligibleRecoveredKickoff(e,disabled,start+480000),false);
 assert.equal(eligibleRecoveredKickoff(e,subscription(start-3600000),start+KICKOFF_WINDOW_MS),false);
});
test('unrelated settings preserve per-route activation and removing/readding a follow resets its server timing',()=>{
 const s=subscription(start-3600000),p=structuredClone(s.preferences);p.breaking.ap=true;assert.deepEqual(kickoffAccessTimes(s,p,start+1000),s.kickoffAccess);
 const off={...s,preferences:{...s.preferences,following:{enabled:true,items:[]}}};assert.equal(kickoffAccessTimes(off,p,start+1000).follows['game:123'],start+1000);
});
