import {configuredPulseStore} from '../app/lib/pulse-story-runtime.ts';
import {capturedNews} from '../app/lib/news-pulse-ingestion.ts';

import{test}from'node:test';import assert from'node:assert/strict';
import{fillPulseArchive}from'../app/lib/pulse-archive-fill.ts';import{emptyArchive,type StoryStore}from'../app/lib/pulse-story-store.ts';import type{NewsPacket}from'../app/lib/news-pulse.ts';
const now=Date.now(),packet:NewsPacket={version:1,mode:'live',evaluatedAt:new Date(now).toISOString(),items:[],sources:[],pushDelivery:false};
// An empty initial state still requires a first commit; subsequent identical stored state does not.
test('concurrent archive winner is read once rather than poisoning cache with an empty failure',async()=>{let reads=0,commits=0;const saved={...emptyArchive(),generation:1,checkedAt:new Date(now).toISOString()};const store:StoryStore={read:async()=>++reads===1?{state:null,etag:'v0'}:{state:saved,etag:'v1'},commit:async()=>{commits++;return 'conflict';}};const r=await fillPulseArchive(store,now,undefined,async()=>packet);assert.equal(r.mode,'live');assert.equal(r.freshness?.[0].status,'cached');assert.equal(reads,2);assert.equal(commits,1);});
test('limited writes do not retry, conflict readback failure is not hidden',async()=>{for(const status of ['limited','conflict'] as const){let reads=0,commits=0;const store:StoryStore={read:async()=>{reads++;return {state:null,etag:'v0'};},commit:async()=>{commits++;return status;}};if(status==='limited'){const result=await fillPulseArchive(store,now,undefined,async()=>packet);assert.equal(result.items,packet.items);assert.equal(result.freshness?.at(-1)?.status,'unavailable');}else await assert.rejects(()=>fillPulseArchive(store,now,undefined,async()=>packet));assert.equal(reads,status==='conflict'?2:1);assert.equal(commits,1);}});
test('saved commit and unchanged snapshot avoid extra reads or writes',async()=>{let reads=0,commits=0;const state={...emptyArchive(),generation:1};const store:StoryStore={read:async()=>{reads++;return {state,etag:'v1'};},commit:async()=>{commits++;return 'saved';}};await fillPulseArchive(store,now,undefined,async()=>packet);assert.equal(reads,1);assert.equal(commits,0);});
test('a write transport failure preserves the verified read and skips retry',async()=>{
 const saved={...emptyArchive(),generation:1};
 let writes=0;
 const store:StoryStore={
  read:async()=>({state:null,etag:'v0'}),
  commit:async()=>{writes++;throw new Error('transport unavailable');}
 };
 const result=await fillPulseArchive(store,now,saved.items,async()=>packet);
 assert.equal(result.items,packet.items);
 assert.match(result.freshness?.at(-1)?.message||'',/storage is temporarily limited/);
 assert.equal(writes,1);
});

const reviewedEnv = {
  VERCEL_ENV:'production', FOURTH_DOWN_PULSE_RELEASE:'official-feed-v1',
  FOURTH_DOWN_PULSE_ARCHIVE:'isolated-v1', NEXT_PUBLIC_FOURTH_DOWN_NEWS_PILOT:'true',
  KV_REST_API_URL:'https://example.upstash.io', KV_REST_API_TOKEN:'test-only',
};

for (const [status, expected] of [[400, 'HTTP 400 (access denied)'], [200, 'Redis error in HTTP 200 body (access denied)']] as const) {
  test(`archive failure at HTTP ${status} preserves verified-source results and logs only a safe reason`, async t => {
    const warning = t.mock.method(console, 'warn', () => {});
    const body = JSON.stringify({error:'NOPERM private provider text'});
    let requests = 0, sourceReads = 0;
    const store = configuredPulseStore(reviewedEnv, async () => {
      requests++;
      return new Response(body, {status, headers:{'Content-Length':String(Buffer.byteLength(body))}});
    })!;
    const items = capturedNews(Date.parse('2026-10-31T15:06:14.900838Z'));
    assert.ok(items.length > 0);
    const result = await fillPulseArchive(store, now, undefined, async () => {
      sourceReads++;
      return {...packet, items};
    });
    assert.deepEqual(warning.mock.calls.map(c => c.arguments), [['Pulse archive unavailable', 'read', expected]]);
    assert.deepEqual(result.items, items);
    assert.equal(result.freshness?.[0]?.status, 'unavailable');
    assert.doesNotMatch(JSON.stringify(result), /private provider text|NOPERM/);
    assert.equal(requests, 1);
    assert.equal(sourceReads, 1);
  });
}

test('HTTP 400 on the archive POST after a successful read retains the ingested items', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const modes: string[] = [];
  const stamp = Date.parse('2026-10-31T12:00:00Z');
  const items = capturedNews(stamp);
  assert.ok(items.length);
  const store = configuredPulseStore(reviewedEnv, async (_url, init) => {
    const mode = JSON.parse(String(init?.body))[5];
    modes.push(mode);
    return mode === 'read' ? Response.json({result:['read','','v0']})
      : Response.json({error:'private error text'}, {status:400});
  })!;
  const result = await fillPulseArchive(store, stamp, [], async () => ({...packet, items}));
  assert.deepEqual(modes, ['read','commit']);
  assert.deepEqual(result.items, items);
  assert.equal(result.freshness?.at(-1)?.status, 'unavailable');
  assert.deepEqual(warning.mock.calls.map(c => c.arguments), [['Pulse archive unavailable','commit','HTTP 400 (unclassified)']]);
});
