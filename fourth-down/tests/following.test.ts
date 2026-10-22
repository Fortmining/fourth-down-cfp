import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultAlertPreferences,normalizePreferences,remainingFollows,selectedEvent,type TemporaryFollow,type AlertEvent} from '../app/lib/alerts.ts';
const now=Date.now();
const follow=(extra:Partial<TemporaryFollow>={}):TemporaryFollow=>({kind:'team',id:'1',name:'One',duration:'24h',createdAt:now-1000,expiresAt:now+86400000-1000,...extra});
const event=(extra:Partial<AlertEvent>={}):AlertEvent=>({id:'game:123:kickoff',types:['kickoff'],teamIds:['1','2'],title:'Kickoff',body:'One at Two',url:'/game/123',observedAt:now,...extra});
test('v0.5 settings migrate with all permanent preferences intact and following off',()=>{
 const p=defaultAlertPreferences();delete p.following;p.favorites=[{id:'1',name:'One'}];p.myTeams={enabled:true,kickoff:true,final:false};p.breaking.enabled=true;p.breaking.ap=true;
 const migrated=normalizePreferences(p);assert.deepEqual(migrated.favorites,p.favorites);assert.deepEqual(migrated.myTeams,p.myTeams);assert.deepEqual(migrated.breaking,p.breaking);assert.deepEqual(migrated.following,{enabled:false,items:[]});
});
test('normalization bounds malformed, duplicate and oversize follows without sliding expiry',()=>{
 const p=defaultAlertPreferences();p.following={enabled:true,items:[follow(),follow(),follow({id:'x'}),follow({id:'2',expiresAt:now+8*86400000}),follow({kind:'game',id:'3',gameId:'4',duration:'game'}),follow({id:'5',name:''})]};
 const normalized=normalizePreferences(p);assert.equal(normalized.following!.items.length,1);assert.equal(normalized.following!.items[0].expiresAt,p.following.items[0].expiresAt);
 assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(normalized))),normalized);
});
test('one-game binding never rolls into the next game and ignores events before follow',()=>{
 const p=defaultAlertPreferences();p.following={enabled:true,items:[follow({duration:'game',gameId:'123'})]};
 assert.equal(selectedEvent(event(),p),true);assert.equal(selectedEvent(event({id:'game:456:kickoff'}),p),false);assert.equal(selectedEvent(event({observedAt:now-2000}),p),false);
 p.following.items=[follow({expiresAt:now-1})];assert.equal(selectedEvent(event(),p),false);
 p.following.items=[follow()];p.following.enabled=false;assert.equal(selectedEvent(event(),p),false);
});
test('final expiry requires confirmed completed final, keeps timed teams and permanent favorites',()=>{
 const p=defaultAlertPreferences();p.favorites=[{id:'1',name:'One'}];p.following={enabled:true,items:[follow({duration:'game',gameId:'123'}),follow({id:'2',duration:'7d',expiresAt:now+7*86400000-1000})]};
 const g={id:'123',date:new Date().toISOString(),name:'One at Two',status:'post',completed:true,providerStatus:'STATUS_FINAL',teams:[{id:'1',name:'One',score:'21'},{id:'2',name:'Two',score:'7'}]};
 assert.equal(remainingFollows(p,[{...g,completed:false}],now).length,2);assert.equal(remainingFollows(p,[{...g,providerStatus:'STATUS_POSTPONED'}],now).length,2);
 assert.deepEqual(remainingFollows(p,[g],now).map(f=>f.id),['2']);assert.equal(p.favorites.length,1);
});
