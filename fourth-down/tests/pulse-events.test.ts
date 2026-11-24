import test from 'node:test';
import assert from 'node:assert/strict';
import {currentFootballEvents,ingestFootballEvents,planPlayerUpdateAlerts} from '../app/lib/pulse-events.ts';
import {footballEventHistory} from '../app/lib/pulse-official-events.ts';

test('official records carry stable IDs, source provenance, and explicit enrollment precision',()=>{
 assert.equal(footballEventHistory.length,7);
 assert.equal(new Set(footballEventHistory.map(row=>row.id)).size,7);
 assert.equal(footballEventHistory.filter(row=>row.kind==='arrival'&&row.precision==='month').length,4);
 assert.ok(footballEventHistory.every(row=>row.source.verification==='official'&&new URL(row.source.url).hostname==='utsports.com'));
});

test('repeat imports are idempotent and higher revisions can retract without destroying history',()=>{
 const original=footballEventHistory[0];
 assert.deepEqual(ingestFootballEvents(footballEventHistory,footballEventHistory),footballEventHistory);
 const history=ingestFootballEvents(footballEventHistory,[{...original,revision:2,status:'retracted'}]);
 assert.equal(history.length,8);
 assert.ok(!currentFootballEvents(history).some(row=>row.id===original.id));
 assert.throws(()=>ingestFootballEvents(history,[{...original,eventDate:'2025-12-04'}]),/Conflicting/);
 assert.throws(()=>ingestFootballEvents([], [{...original,eventDate:'2026-02-30'}]),/Invalid/);
});

test('private player alerts require a new day-precise official event and an active team',()=>{
 const source=footballEventHistory[0];
 const event={...source,id:'test-signing',kind:'signing' as const,precision:'day' as const,eventDate:'2026-12-03'};
 const teams=new Map([[event.school.id,'2026-12-01']]);
 const enabled=new Set(['signing'] as const);
 const plan=(history:typeof event[], seen=new Set<string>())=>
  planPlayerUpdateAlerts(history,teams,enabled,'2026-12-02','2026-12-03',seen);
 const result=plan([event]);
 assert.equal(result.length,1);
 assert.deepEqual(plan([event],new Set([result[0].key])),[]);
 assert.deepEqual(plan([event,{...event,revision:2,status:'retracted'}]),[]);
 assert.deepEqual(plan([{...event,source:{...event.source,verification:'reported'}}]),[]);
 teams.set(event.school.id,event.eventDate);
 assert.deepEqual(plan([event]),[]);
});
