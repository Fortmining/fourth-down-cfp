import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesPulseDesk,signingCalendarStatus} from '../app/lib/pulse-desks.ts';
import type {NewsItem} from '../app/lib/news-pulse.ts';

test('coverage desks route publisher headlines without creating player or transaction records',()=>{
 const sample: NewsItem = {
  id:'test', sourceId:'test', sourceName:'Test', title:'Test headline', url:'https://example.org/test',
  publishedAt:null, updatedAt:'2026-11-01T00:00:00Z', kind:'news', football:true,
  teamIds:[], matchEvidence:[], clusterId:'test',
 };
 const cases=[
  ['signing','Football early signing period opens'],
  ['portal','Quarterback reportedly considering transfer portal'],
  ['recruiting','Football recruit announces decommitment'],
  ['availability','Coach discusses injury after practice'],
  ['money','Athletics budget includes revenue sharing'],
 ] as const;
 for(const [desk,title] of cases){
  const item={...sample,title};
  assert.equal(matchesPulseDesk(item,desk),true);
  assert.equal(matchesPulseDesk({...item,title:'Weekend scoreboard'},desk),false);
 }
 assert.equal(matchesPulseDesk({...sample,title:'Opponent preview',teamIds:['2633'],kind:'analysis'},'team'),true);
});

test('signing calendar handles both published periods and the intervening gap',()=>{
 assert.equal(signingCalendarStatus('2026-12-01'),'Early signing dates ahead');
 assert.equal(signingCalendarStatus('2026-12-02'),'Early signing dates');
 assert.equal(signingCalendarStatus('2026-12-04'),'Early signing dates');
 assert.equal(signingCalendarStatus('2026-12-05'),'Early signing dates have passed');
 assert.equal(signingCalendarStatus('2027-02-03'),'Regular signing has reached its published start date');
});
