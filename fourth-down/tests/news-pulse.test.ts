import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchNews,normalizeNews,newsSources,newsUrl,reconcileNews,visibleNews,newsReasons,newsIsStale,readNewsPacket,type Candidate,type MatchTeam} from '../app/lib/news-pulse.ts';
import {newsFixturePacket,NEWS_SCENARIO_AT} from '../app/lib/news-pulse-fixtures.ts';
import {defaultNewsPreferences,validateNewsPreferences,inNewsQuietHours,newsPushEnabled} from '../app/lib/news-pulse-preferences.ts';
const now=Date.parse(NEWS_SCENARIO_AT);
const teams:MatchTeam[]=[{id:'2633',name:'Tennessee Volunteers',aliases:['Tennessee Volunteers','Vols']},{id:'2579',name:'South Carolina Gamecocks',aliases:['South Carolina Gamecocks','USC']},{id:'30',name:'USC Trojans',aliases:['USC Trojans','USC']}];
const candidate:Candidate={id:'test-story',sourceId:'tennessee-youtube',title:'Sample: Tennessee Volunteers football update',url:newsSources[0].home,football:true,fixture:true,kind:'news',publishedAt:'2026-10-30T17:00:00Z',updatedAt:'2026-10-30T17:00:00Z'};
const normalize=(c:Partial<Candidate>={})=>normalizeNews({...candidate,...c},teams,[],now,true)!;
test('only explicit offline fixtures are accepted; pending or disconnected live sources stay blocked',()=>{
 assert.ok(normalize());assert.equal(normalizeNews(candidate,teams,[],now),null);assert.equal(normalizeNews({...candidate,fixture:false},teams,[],now,true),null);assert.ok(newsSources.every(s=>!s.connected));
});
test('source URL validation rejects hostile origins, schemes, credentials, ports and fake clip links',()=>{
 const s=newsSources[0];for(const u of ['http://www.youtube.com/watch?v=M7lc1UVf-VE','javascript:alert(1)','https://www.youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://u:p@www.youtube.com/watch?v=M7lc1UVf-VE','https://www.youtube.com:444/watch?v=M7lc1UVf-VE','https://www.youtube.com/redirect?url=https://evil.test','https://127.0.0.1/'])assert.equal(newsUrl(u,s),null);
 assert.equal(newsUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE&utm_source=example',s),'https://www.youtube.com/watch?v=M7lc1UVf-VE');assert.equal(newsUrl(s.home,s,true),s.home);
});
test('football, publication timestamps, markup and future revisions are validated',()=>{
 for(const c of [{football:false},{publishedAt:'invalid'},{publishedAt:'2026-10-31T17:00:00Z'},{updatedAt:'2026-10-31T17:00:00Z'},{title:'<script>bad</script>'},{id:'../../bad'}])assert.equal(normalizeNews({...candidate,...c},teams,[],now,true),null);
 assert.ok(normalize({publishedAt:null}));
});
test('team matching uses bounded aliases and withholds ambiguous USC rather than guessing',()=>{
 assert.deepEqual(matchNews(candidate,teams,[]).teamIds,['2633']);assert.deepEqual(matchNews({...candidate,title:'Sample: USC football'},teams,[]).teamIds,[]);assert.deepEqual(matchNews({...candidate,title:'Sample: Revolution football'},teams,[]).teamIds,[]);
});
test('game match needs both participants, explicit known game identity and compatible date',()=>{
 const c={...candidate,title:'Sample: Tennessee Volunteers vs South Carolina Gamecocks',gameId:'401856731'};
 const game={id:'401856731',teamIds:['2633','2579'],date:'2026-10-30T18:00:00Z'};
 assert.equal(matchNews(c,teams,[game]).gameId,game.id);assert.equal(matchNews({...c,title:candidate.title},teams,[game]).gameId,undefined);assert.equal(matchNews({...c,gameId:'unknown'},teams,[game]).gameId,undefined);assert.equal(matchNews(c,teams,[{...game,date:'2026-09-01T18:00:00Z'}]).gameId,undefined);
});
test('duplicate fetches and delayed revisions do not duplicate or overwrite newer content',()=>{
 const a=normalize(),b=normalize({title:'Sample: corrected',state:'corrected',updatedAt:'2026-10-30T17:30:00Z'});const rows=reconcileNews(reconcileNews([a],[b]),[a,b]);assert.equal(rows.length,1);assert.equal(rows[0].title,b.title);
});
test('corrections retain original publication time and cannot rejuvenate stale stories',()=>{
 const a=normalize({publishedAt:'2026-10-28T10:00:00Z'});const b=normalize({publishedAt:'2026-10-30T17:20:00Z',updatedAt:'2026-10-30T17:30:00Z',state:'corrected'});const [r]=reconcileNews([a],[b]);assert.equal(r.publishedAt,a.publishedAt);assert.ok(newsIsStale(r,now));
});
test('retractions persist as tombstones, hiding withdrawn items despite delayed original data',()=>{
 const a=normalize(),b=normalize({state:'retracted',updatedAt:'2026-10-30T17:30:00Z'});const rows=reconcileNews(reconcileNews([a],[b]),[a]);assert.equal(rows.length,1);assert.equal(visibleNews(rows,now).length,0);
});
test('equal-version conflicting content is withheld until a genuinely newer correction',()=>{
 const a=normalize(),b=normalize({title:'Sample: contradictory details'});const held=reconcileNews([a],[b]);assert.equal(visibleNews(held,now).length,0);const repaired=reconcileNews(held,[normalize({title:'Sample: confirmed correction',updatedAt:'2026-10-30T17:30:00Z',state:'corrected'})]);assert.equal(visibleNews(repaired,now).length,1);
});
test('verified story identity clusters alternative items; similar text alone does not',()=>{
 const a=normalize({verifiedStoryKey:'official-event'}),b=normalize({id:'other',sourceId:'texas-football',url:newsSources[2].home,verifiedStoryKey:'official-event'});assert.equal(visibleNews([a,b],now).length,1);assert.equal(visibleNews([normalize(),normalize({id:'other'})],now).length,2);
});
test('unknown publication time is explicit, stale and not filled with retrieval time',()=>{
 const i=normalize({publishedAt:null});assert.equal(i.publishedAt,null);assert.ok(newsIsStale(i,now));assert.equal(visibleNews([i],now).length,1);assert.equal(visibleNews([normalize({publishedAt:'2026-10-01T12:00:00Z'})],now).length,0);
});
test('favorites and unexpired temporary follows produce distinct reasons without duplicating items',()=>{
 const i=normalize(),audience={favorites:[{id:'2633',name:'Tennessee Volunteers'}],following:{items:[{kind:'team',id:'2633',createdAt:now-100,expiresAt:now+100}]}};
 assert.deepEqual(newsReasons(i,audience,now),['Favorite team: Tennessee Volunteers','Temporary team follow']);assert.deepEqual(newsReasons(i,{...audience,favorites:[],following:{items:[{kind:'team',id:'2633',createdAt:now-100,expiresAt:now}]}},now),[]);
});
test('game-only follows do not expand into all news about participating teams',()=>{
 const audience={favorites:[],following:{items:[{kind:'game',id:'401856731',gameId:'401856731',createdAt:now-100,expiresAt:now+100}]}};
 assert.deepEqual(newsReasons(normalize(),audience,now),[]);assert.deepEqual(newsReasons({...normalize(),gameId:'401856731'},audience,now),['Temporary game follow']);
});
test('fixture cards never invent published story URLs, clip identities or true breaking labels',()=>{
 const packet=newsFixturePacket();assert.equal(packet.pushDelivery,false);assert.equal(packet.mode,'fixtures');for(const i of packet.items){assert.ok(i.fixture);assert.ok(i.title.startsWith('Sample:'));assert.equal(i.url,newsSources[0].home);assert.equal(i.gameId,undefined);}assert.equal(packet.items.length,7);
});
test('separate preference defaults retain requested ON/OFF categories without enabling push',()=>{
 const p=defaultNewsPreferences();for(const scope of ['favorites','temporary'] as const)assert.deepEqual(p[scope],{breaking:true,highlights:true,routine:false,recaps:false});assert.equal(p.national,true);assert.equal(newsPushEnabled(),false);p.favorites.highlights=false;assert.equal(p.temporary.highlights,true);assert.equal(defaultNewsPreferences().favorites.highlights,true);
});
test('saved custom choices round-trip; malformed settings and unsafe limits are rejected',()=>{
 const p=defaultNewsPreferences();p.favorites.breaking=false;assert.deepEqual(validateNewsPreferences(JSON.parse(JSON.stringify(p))),p);assert.equal(validateNewsPreferences({...p,limits:{perHour:3,perDay:12}}),null);assert.equal(validateNewsPreferences({...p,limits:{perHour:2,perDay:1}}),null);assert.equal(validateNewsPreferences({...p,quiet:{...p.quiet,timeZone:'not/a_zone'}}),null);assert.equal(validateNewsPreferences({...p,quiet:{...p.quiet,enabled:true,start:'08:00',end:'08:00'}}),null);
});
test('quiet hours span midnight, handle boundaries, and follow DST in the selected zone',()=>{
 const p=defaultNewsPreferences();p.quiet={enabled:true,timeZone:'America/New_York',start:'22:00',end:'08:00'};
 for(const at of ['2026-10-31T02:00:00Z','2026-11-01T05:30:00Z','2026-11-01T06:30:00Z','2026-11-02T03:00:00Z'])assert.equal(inNewsQuietHours(p,Date.parse(at)),true,at);
 assert.equal(inNewsQuietHours(p,Date.parse('2026-10-31T12:00:00Z')),false);p.quiet={...p.quiet,start:'12:00',end:'13:00'};assert.equal(inNewsQuietHours(p,Date.parse('2026-10-30T16:30:00Z')),true);assert.equal(inNewsQuietHours(p,Date.parse('2026-10-30T17:00:00Z')),false);
});
test('new feed/preference boundary has no Redis, external fetch, push or subscription mutation',()=>{
 const route=fs.readFileSync(new URL('../app/api/news-pulse/route.ts',import.meta.url),'utf8');assert.ok(!/fetch\(|redis\(|webpush|CRON_SECRET/.test(route));assert.match(route,/newsFixturesEnabled/);
 const prefs=fs.readFileSync(new URL('../app/components/NewsPulsePreferences.tsx',import.meta.url),'utf8');assert.ok(!/fetch\(|requestPermission|pushManager|storePreferences\(/.test(prefs));
 const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));assert.equal(config.git.deploymentEnabled['feature/pulse-feed-pilot'],false);
});
test('malformed packets and forged unsafe links fail safely instead of crashing feed rendering',()=>{
 const p=newsFixturePacket();assert.ok(readNewsPacket(p));assert.equal(readNewsPacket({...p,items:[{}]}),null);assert.equal(readNewsPacket({...p,pushDelivery:true}),null);assert.equal(readNewsPacket({...p,items:[{...p.items[0],url:'https://evil.test'}]}),null);assert.equal(readNewsPacket({...p,items:[{...p.items[0],teamIds:null}]}),null);
});
