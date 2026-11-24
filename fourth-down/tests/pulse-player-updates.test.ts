import test from 'node:test';
import assert from 'node:assert/strict';
import {followedPlayerTeams,matchesPlayerTeam,playerUpdateTimeline} from '../app/lib/pulse-player-updates.ts';
import {officialFootballEvents} from '../app/lib/pulse-official-events.ts';
import inventory from '../app/data/pulse-teams-2026.json' with {type:'json'};
import type {FootballEvent} from '../app/lib/pulse-events.ts';
import type {NewsAudience} from '../app/lib/news-pulse.ts';
const now=Date.parse('2026-11-24T18:00:00Z');
const sample=(overrides:Partial<FootballEvent>={}):FootballEvent=>({...officialFootballEvents[0],id:'controlled-test',eventDate:'2026-11-20',precision:'day',...overrides});

test('November source checks cannot turn December 2025 signings or January 2026 enrollments into recent news',()=>{
 const records=officialFootballEvents.map(event=>({...event,source:{...event.source,observedOn:'2026-11-24'}}));
 const result=playerUpdateTimeline(records,now);
 assert.equal(result.recent.length,0);assert.equal(result.history.length,7);
 assert.deepEqual(new Set(result.history.map(e=>e.id)),new Set(records.map(e=>e.id)));
});

test('recent means thirty calendar dates by event date; future, month-only and retracted records are not current',()=>{
 const rows=[sample({id:'boundary',eventDate:'2026-10-26'}),sample({id:'too-old',eventDate:'2026-10-25'}),sample({id:'today',eventDate:'2026-11-24'}),sample({id:'future',eventDate:'2026-11-25'}),sample({id:'month',eventDate:'2026-11-01',precision:'month'}),sample({id:'retracted',status:'retracted'})];
 const {recent,history,cutoff}=playerUpdateTimeline(rows,now);
 assert.equal(cutoff,'2026-10-26');assert.deepEqual(recent.map(e=>e.id),['today','boundary']);
 assert.deepEqual(new Set(history.map(e=>e.id)),new Set(['too-old','month']));
 const correction=sample({eventDate:'2025-12-03',revision:2,source:{...rows[0].source,observedOn:'2026-11-24'}});
 assert.equal(playerUpdateTimeline([correction],now).recent.length,0);
});

test('favorites and currently active temporary TEAM follows set scope independently of notification opt-in',()=>{
 const audience:NewsAudience={favorites:[{id:'61',name:'Georgia Bulldogs'}],following:{enabled:false,items:[
  {kind:'team',id:'2483',createdAt:now-1000,expiresAt:now+1000},
  {kind:'team',id:'2633',createdAt:now-2000,expiresAt:now-1},
  {kind:'team',id:'333',createdAt:now+1,expiresAt:now+2000},
  {kind:'game',id:'123',gameId:'123',createdAt:now-1000,expiresAt:now+1000},
 ]}};
 assert.deepEqual([...followedPlayerTeams(audience,now)],['61','2483']);
 assert.equal(matchesPlayerTeam(sample(),followedPlayerTeams(audience,now)),false);
 assert.equal(matchesPlayerTeam(sample({school:{id:'61',name:'Georgia'}}),followedPlayerTeams(audience,now)),true);
 assert.equal(matchesPlayerTeam(sample({from:{id:'2483',name:'Oregon'}}),followedPlayerTeams(audience,now)),true);
 assert.equal(followedPlayerTeams({favorites:[]},now).size,0);
});

test('each of the 138 FBS teams can select its own records without a Tennessee fallback',()=>{
 assert.equal(inventory.teams.length,138);
 const events=inventory.teams.map(t=>sample({id:'test:'+t.id,school:{id:t.id,name:t.name},from:undefined}));
 for(const team of inventory.teams){
  const ids=followedPlayerTeams({favorites:[{id:team.id,name:team.name}]},now);
  const filtered=events.filter(e=>matchesPlayerTeam(e,ids));
  assert.deepEqual(filtered.map(e=>e.school.id),[team.id]);assert.equal(playerUpdateTimeline(filtered,now).recent.length,1);
 }
});

test('transfer history remains relevant to either side of a move, without claiming monitoring of unrelated teams',()=>{
 const original=sample({eventDate:'2026-01-01',precision:'month',from:{id:'213',name:'Penn State'}});
 for(const id of ['2633','213'])assert.equal(playerUpdateTimeline([original].filter(e=>matchesPlayerTeam(e,new Set([id]))),now).history.length,1);
 assert.equal([original].filter(e=>matchesPlayerTeam(e,new Set(['61','2483']))).length,0);
});
