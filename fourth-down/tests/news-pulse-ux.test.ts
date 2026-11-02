import test from 'node:test';import assert from 'node:assert/strict';
import {newsFixturePacket} from '../app/lib/news-pulse-fixtures.ts';import {newsSources,type NewsSource} from '../app/lib/news-pulse.ts';import {newsCardLink,newsCardImage} from '../app/lib/news-pulse-media.ts';
import {defaultNewsPreferences,validateNewsPreferences,applyNewsPlan,newsPlanSelection,timeZoneOptions,newsPushEnabled} from '../app/lib/news-pulse-preferences.ts';
const now=Date.parse('2026-10-31T10:00:00Z'),source=newsSources[0],sample=newsFixturePacket().items[0];
const video={...sample,fixture:false,url:'https://www.youtube.com/watch?v=M7lc1UVf-VE',contentEvidence:{url:'https://www.youtube.com/watch?v=M7lc1UVf-VE',resourceId:'M7lc1UVf-VE',resourceType:'video' as const,verifiedAt:'2026-10-30T10:00:00Z'}};
test('live highlight contract requires exact verified video; no channel or homepage substitution',()=>{
 assert.equal(newsCardLink(video,source,now)?.url,video.url);assert.equal(newsCardLink({...video,url:source.home},source,now),null);assert.equal(newsCardLink({...video,contentEvidence:undefined},source,now),null);assert.equal(newsCardLink({...video,contentEvidence:{...video.contentEvidence,resourceId:'different'}},source,now),null);assert.equal(newsCardLink({...video,url:'https://evil.test/watch?v=M7lc1UVf-VE'},source,now),null);
});
test('live article contract requires permission, article identity and exact verified article URL',()=>{
 const s:NewsSource={...newsSources[1],permission:'granted',imageHosts:['images.ncaa.com']};const url='https://www.ncaa.com/news/football/fbs/2026-10-31/unit-test-only';const item={...video,kind:'news' as const,sourceId:s.id,url,contentEvidence:{...video.contentEvidence,url,resourceType:'article' as const,resourceId:'unit-test'}};
 assert.equal(newsCardLink(item,s,now)?.url,url);assert.equal(newsCardLink(item,newsSources[1],now),null);assert.equal(newsCardLink({...item,url:s.home},s,now),null);assert.equal(newsCardLink({...item,contentEvidence:{...item.contentEvidence,url:s.home}},s,now),null);
});
test('only content-matched official thumbnail/approved image can render; samples always use branded fallback',()=>{
 const image={url:'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg',contentUrl:video.url,verifiedAt:'2026-10-30T10:00:00Z',permission:'provider-thumbnail' as const,attribution:'YouTube / official publisher'};
 assert.equal(newsCardImage({...video,image},source,now),image.url);assert.equal(newsCardImage({...sample,image},source,now),null);assert.equal(newsCardImage({...video,image:{...image,url:'https://i.ytimg.com/vi/unrelated/hqdefault.jpg'}},source,now),null);assert.equal(newsCardImage({...video,image:{...image,contentUrl:source.home}},source,now),null);assert.equal(newsCardImage({...video,image:{...image,url:'https://evil.test/photo.jpg'}},source,now),null);
});
test('Balanced starts at 12/day; explicit intensity actions set 3/12/30 independent team budgets',()=>{
 const p=defaultNewsPreferences('America/New_York');assert.equal(p.limits.perDay,12);assert.equal(newsPlanSelection(p),'balanced');assert.equal(p.quiet.timeZone,'America/New_York');for(const [plan,expected] of [['quiet',3],['balanced',12],['allIn',30]] as const){const next=applyNewsPlan(plan,p);assert.equal(next.limits.perDay,expected);assert.equal(newsPlanSelection(next),plan);assert.deepEqual(next.favorites,p.favorites);assert.ok(next.nationalLimits.perDay<next.limits.perDay);}assert.equal(newsPushEnabled(),false);
});
test('custom budgets and saved categories survive reload and legacy migration without silent default changes',()=>{
 const p=defaultNewsPreferences();p.limits.perDay=17;p.favorites.highlights=false;assert.equal(newsPlanSelection(p),'custom');assert.deepEqual(validateNewsPreferences(JSON.parse(JSON.stringify(p))),p);
 const old={...p,version:1,limits:{perHour:2,perDay:6}};const next=validateNewsPreferences(old)!;assert.equal(next.version,2);assert.equal(next.limits.perDay,6);assert.equal(next.favorites.highlights,false);assert.equal(newsPlanSelection(next),'custom');assert.equal(next.nationalLimits.perDay,1);
});
test('timezone picker includes detected and saved IANA identifiers with safe fallback',()=>{const options=timeZoneOptions('America/New_York','Asia/Kolkata');assert.ok(options.includes('America/New_York'));assert.ok(options.includes('Asia/Kolkata'));assert.ok(options.includes('UTC'));assert.equal(defaultNewsPreferences('Invalid/Zone').quiet.timeZone,'UTC');});
