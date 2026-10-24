import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesFollow,orderedWatchGames,watchClock,type WatchGame} from '../app/lib/watchlist.ts';
import type {TemporaryFollow} from '../app/lib/alerts.ts';
const now=Date.now();
const follow:TemporaryFollow={kind:'team',id:'1',name:'One',duration:'7d',createdAt:now-10000,expiresAt:now+10000};
const game=(id:string,status:string):WatchGame=>({id,name:id,date:new Date(now).toISOString(),status,teams:[{id:'1',name:'One'},{id:'2',name:'Two'}]});
test('watchlist orders live, upcoming, completed and deduplicates overlapping follows',()=>{
 assert.deepEqual(orderedWatchGames([game('final','post'),game('upcoming','pre'),game('live','in')],[follow,{...follow,kind:'game',id:'live',duration:'game',gameId:'live'}],now).map(g=>g.id),['live','upcoming','final']);
});
test('expired and one-game team follows do not include unrelated games or favorites',()=>{
 assert.equal(orderedWatchGames([game('1','in')],[{...follow,expiresAt:now}],now).length,0);
 assert.equal(matchesFollow({...follow,duration:'game',gameId:'2'},game('1','in')),false);
 assert.equal(orderedWatchGames([game('1','in')],[],now).length,0);
});
test('clock uses only available valid live feed values',()=>{
 assert.equal(watchClock({...game('1','in'),period:4,clock:299}),'Q4 · 4:59');
 assert.equal(watchClock({...game('1','in'),period:5,clock:0}),'OT · 0:00');
 for(const patch of [{period:4},{period:0,clock:30},{period:4,clock:NaN},{period:4,clock:901},{period:4,clock:-1}])assert.equal(watchClock({...game('1','in'),...patch}),'');
 assert.equal(watchClock({...game('1','pre'),period:1,clock:900}),'');
});
