import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTeamView} from '../app/lib/cfbd-team-view.ts';
const edition={year:2026,observedAt:100,revision:1,source:'CollegeFootballData API',inLatest:true,value:{listed:100,positions:{DB:10}}};
const view={version:1,team:'2633',datasets:{roster:edition}};
test('public reader accepts team-scoped aggregate views and rejects raw or private fields',()=>{
 assert.deepEqual(decodeTeamView(JSON.stringify(view),'2633'),view);
 for(const alt of [{...view,raw:[]},{...view,team:'61'},
  {...view,datasets:{roster:{...edition,value:{...edition.value,players:[]}}}},
  {...view,datasets:{raw:edition}}, {...view,datasets:{roster:{...edition,source:'unknown'}}}])
  assert.equal(decodeTeamView(JSON.stringify(alt),'2633'),null);
});
