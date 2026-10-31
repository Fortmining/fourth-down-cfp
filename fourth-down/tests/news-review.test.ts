import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {newsFixturesEnabled,newsReviewEnabled,newsReviewRewrites} from '../app/lib/news-review-mode.ts';
const flags={FOURTH_DOWN_NEWS_PILOT:'protected-preview-v1',NODE_ENV:'production',VERCEL:'1'};
test('explicit isolated Preview can serve fixtures and intercept all existing integration API families',()=>{
 const e={...flags,VERCEL_ENV:'preview'};assert.ok(newsReviewEnabled(e));assert.ok(newsFixturesEnabled(e));const r=newsReviewRewrites(e);assert.equal(r.length,6);assert.ok(r.every(x=>x.destination.startsWith('/api/news-pulse/review/')));assert.ok(r.some(x=>x.source==='/api/alerts/:path*'));
});
test('production rejects fixture flags and review rewrites unconditionally',()=>{
 for(const value of ['protected-preview-v1','fixtures',undefined]){const e={...flags,FOURTH_DOWN_NEWS_PILOT:value,VERCEL_ENV:'production'};assert.equal(newsReviewEnabled(e),false);assert.equal(newsFixturesEnabled(e),false);assert.deepEqual(newsReviewRewrites(e),[]);}
});
test('unapproved Preview and ordinary production builds stay unavailable; local opt-in remains supported',()=>{
 assert.equal(newsFixturesEnabled({NODE_ENV:'production'}),false);assert.equal(newsFixturesEnabled({...flags,VERCEL_ENV:'preview',FOURTH_DOWN_NEWS_PILOT:undefined}),false);assert.equal(newsFixturesEnabled({NODE_ENV:'development',FOURTH_DOWN_NEWS_PILOT:'fixtures'}),true);assert.equal(newsFixturesEnabled({NODE_ENV:'development',VERCEL:'1',FOURTH_DOWN_NEWS_PILOT:'fixtures'}),false);
});
test('isolated review data and handler have no provider images, network fetch, Redis or push path',()=>{
 const route=fs.readFileSync(new URL('../app/api/news-pulse/review/[resource]/[[...id]]/route.ts',import.meta.url),'utf8');assert.ok(!/fetch\(|redis\(|webpush|CRON_SECRET/.test(route));assert.match(route,/status:403/);assert.match(route,/newsReviewEnabled/);
 const data=JSON.parse(fs.readFileSync(new URL('../app/data/news-review.json',import.meta.url),'utf8'));assert.match(data.feed.updatedAt,/^2026-10-28/);assert.equal(data.feed.scheduleComplete,false);assert.equal(data.team.scheduleAvailable,false);assert.equal(data.team.stats.length,0);assert.ok(!/"logo"|"thumbnail"/.test(JSON.stringify(data)));
});
