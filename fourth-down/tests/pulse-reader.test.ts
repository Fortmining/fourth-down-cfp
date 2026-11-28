import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NEXT_PUBLIC_FOURTH_DOWN_PULSE_RSS='headlines-v1';
const {parseNewsFeed,permittedAdapters}=await import('../app/lib/news-pulse-ingestion.ts');
const {pulseSource}=await import('../app/lib/pulse-source-registry.ts');
const {newsCardImage,newsPreviewImage}=await import('../app/lib/news-pulse-media.ts');
const {defaultPulseFeed,readPulseFeedState,pulseFeedItems,pulseRelativeTime}=await import('../app/lib/pulse-feed-view.ts');
const now=Date.parse('2026-11-27T20:00:00Z');
const feed=(link='https://www.foxsports.com/stories/college-football/michigan-recruiting-news',image='https://a57.foxsports.com/example.jpg')=>`<rss xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>Michigan recruiting update</title><link>${link}</link><pubDate>Fri, 27 Nov 2026 12:00:00 -0500</pubDate><description><![CDATA[<p>Publisher-supplied brief.</p><script>unsafe()</script>]]></description><content:encoded><![CDATA[Full article must never be republished.]]></content:encoded><media:group><media:content type="image/jpeg" url="https://statics.foxsports.com/full.jpg"/><media:thumbnail url="${image}"/></media:group></item></channel></rss>`;
test('only the documented FOX feed is activated; verified CBS/NBC endpoints remain permission-gated',()=>{
 assert.equal(pulseSource('fox-cfb')?.permission,'granted');assert.ok(permittedAdapters().some(s=>s.id==='fox-cfb'));assert.ok(permittedAdapters().length<=9);
 for(const id of ['cbs-cfb','nbc-cfb']){assert.equal(pulseSource(id)?.connected,false);assert.equal(pulseSource(id)?.availability,'permission-needed');assert.ok(!permittedAdapters().some(s=>s.id===id));assert.throws(()=>parseNewsFeed(feed(),id,now),/permission/);}
});
test('reader only receives a plain feed teaser and a verified feed thumbnail, never full article HTML',()=>{
 const rows=parseNewsFeed(feed(),'fox-cfb',now);assert.equal(rows.length,1);const item=rows[0];assert.equal(item.summary,'Publisher-supplied brief.');assert.ok(!JSON.stringify(item).includes('Full article'));assert.ok(!JSON.stringify(item).includes('unsafe()'));assert.equal(item.image?.permission,'feed-thumbnail');assert.equal(newsPreviewImage(item,pulseSource('fox-cfb')!,now),'https://statics.foxsports.com/full.jpg');assert.equal(newsCardImage(item,pulseSource('fox-cfb')!,now),'https://a57.foxsports.com/example.jpg');
 assert.equal(parseNewsFeed(feed(undefined,'https://evil.test/image.jpg'),'fox-cfb',now)[0].image,undefined);assert.equal(parseNewsFeed(feed('https://www.foxsports.com/stories/nfl/michigan-recruiting-news'),'fox-cfb',now).length,0);
});
test('feed filters preserve chronological order, actual team follows, recruiting and portal topics',()=>{
 const item=parseNewsFeed(feed(),'fox-cfb',now)[0];const rows=[{...item,id:'old',title:'Michigan transfer portal update',publishedAt:'2026-11-27T16:00:00Z',teamIds:['130'],contentCategory:'news'},{...item,id:'new',publishedAt:'2026-11-27T18:00:00Z',teamIds:['194'],conferenceIds:['Big Ten Conference']}];
 const audience={favorites:[{id:'130',name:'Michigan'}]};assert.deepEqual(pulseFeedItems(rows,audience,now,defaultPulseFeed).map(i=>i.id),['new','old']);assert.deepEqual(pulseFeedItems(rows,audience,now,{...defaultPulseFeed,tab:'following'}).map(i=>i.id),['old']);assert.deepEqual(pulseFeedItems(rows,audience,now,{...defaultPulseFeed,tab:'portal'}).map(i=>i.id),['old']);assert.deepEqual(pulseFeedItems(rows,audience,now,{...defaultPulseFeed,tab:'recruiting'}).map(i=>i.id),['new']);assert.equal(pulseFeedItems(rows,{favorites:[]},now,{...defaultPulseFeed,tab:'following'}).length,0);
});
test('saved filter and loaded row count restore; explicit team and legacy division links remain usable',()=>{
 assert.equal(readPulseFeedState('',{tab:'portal',limit:90}).tab,'portal');assert.equal(readPulseFeedState('',{tab:'portal',limit:90}).limit,90);assert.equal(readPulseFeedState('?team=130',{tab:'portal'}).tab,'latest');assert.equal(readPulseFeedState('?team=130').team,'130');assert.equal(readPulseFeedState('?view=fcs').division,'fcs');assert.equal(readPulseFeedState('?view=for-you').tab,'following');assert.equal(readPulseFeedState('?feed=bad',{tab:'portal'}).tab,'latest');
});
test('relative publication times handle minutes, hours, days and missing timestamps',()=>{
 assert.equal(pulseRelativeTime('2026-11-27T19:45:00Z',now),'15m ago');assert.equal(pulseRelativeTime('2026-11-27T18:00:00Z',now),'2h ago');assert.equal(pulseRelativeTime('2026-11-26T18:00:00Z',now),'1d ago');assert.equal(pulseRelativeTime(null,now),'Date unavailable');
});
