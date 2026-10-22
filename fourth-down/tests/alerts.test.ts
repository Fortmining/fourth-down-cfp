import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAlertPreferences,normalizePreferences,hasAlerts,deriveAlertEvents,selectedEvent,verifiedDevelopment,type AlertFeed,type AlertGame,type ConfirmedDevelopment } from '../app/lib/alerts.ts';
import type { Poll } from '../app/lib/rankings.ts';
const now=Date.parse('2026-10-22T23:00Z');
const game=(status='pre'):AlertGame=>({id:'g1',name:'Favorite at Ranked',date:'2026-10-22T22:00Z',status,providerStatus:status==='post'?'STATUS_FINAL':status==='in'?'STATUS_IN_PROGRESS':'STATUS_SCHEDULED',completed:status==='post',teams:[{id:'1',name:'Favorite',score:'31',winner:status==='post'},{id:'2',name:'Ranked',rank:3,score:'28',winner:false}]});
const poll=(id:Poll['id'],week:number):Poll=>({id,name:id,url:'https://apnews.com',status:'available',week,season:2026,date:new Date(now-(week===8?86400_000:1000)).toISOString(),message:'Published',teams:Array.from({length:25},(_,i)=>({rank:i+1,previous:i+1,teamId:String(i+1),name:`Team ${i+1}`,record:'6-0',conference:'FBS'}))});
const feed=(status='pre',week=8,offset=0):AlertFeed=>({season:2026,updatedAt:new Date(now+offset).toISOString(),games:[game(status)],polls:[poll('ap',week),poll('coaches',week),{...poll('cfp',week),teams:[],status:'not_published',date:null}]});
const old=()=>feed('pre',8,-60000);
test('all categories and subtypes default off; invalid stored values cannot opt in',()=>{
 const p=defaultAlertPreferences();assert.equal(hasAlerts(p),false);
 assert.deepEqual(normalizePreferences({myTeams:{enabled:'true'},favorites:[{id:'script',name:'Bad'}]}),p);
});
test('favorite IDs deduplicate and normalize without retaining extra data',()=>{
 assert.deepEqual(normalizePreferences({favorites:[{id:'1',name:'A',extra:'secret'},{id:'1',name:'Duplicate'}]}).favorites,[{id:'1',name:'A'}]);
});
test('kickoff follows confirmed live status, not a scheduled clock or pregame countdown',()=>{
 assert.equal(deriveAlertEvents(old(),feed('pre'),[],now).length,0);
 const events=deriveAlertEvents(old(),feed('in'),[],now);assert.equal(events.length,1);assert.deepEqual(events[0].types,['kickoff']);
 const unknown=feed('in');unknown.games[0].providerStatus='STATUS_DELAYED';assert.equal(deriveAlertEvents(old(),unknown,[],now).length,0);
});
test('final plus major upset coalesce into one event; no speculative live upset',()=>{
 const events=deriveAlertEvents(old(),feed('post'),[],now);assert.equal(events.length,1);assert.deepEqual(events[0].types,['final','upset']);
 assert.equal(deriveAlertEvents(old(),feed('in'),[],now).some(e=>e.types.includes('upset')),false);
});
test('canceled, incomplete, missing-score, tied, and unconfirmed outcomes never become upset alerts',()=>{
 for(const mutate of [(g:AlertGame)=>{g.completed=false;},(g:AlertGame)=>{g.providerStatus='STATUS_CANCELED';},(g:AlertGame)=>{g.teams[0].score=undefined;}]){
  const f=feed('post');mutate(f.games[0]);assert.equal(deriveAlertEvents(old(),f,[],now).length,0);
 }
 const f=feed('post');f.games[0].teams[0].winner=false;assert.deepEqual(deriveAlertEvents(old(),f,[],now)[0].types,['final']);
 f.games[0].teams[0].score='28';assert.deepEqual(deriveAlertEvents(old(),f,[],now)[0].types,['final']);
});
test('category and subtype settings are independent, including a matching final through either category',()=>{
 const e=deriveAlertEvents(old(),feed('post'),[],now)[0];const p=defaultAlertPreferences();p.favorites=[{id:'1',name:'Favorite'}];
 p.myTeams.enabled=true;p.myTeams.final=true;assert.equal(selectedEvent(e,p),true);
 p.myTeams.enabled=false;assert.equal(selectedEvent(e,p),false);
 p.breaking.enabled=true;p.breaking.upsets=true;assert.equal(selectedEvent(e,p),true);
 p.breaking.upsets=false;p.breaking.ap=true;assert.equal(selectedEvent(e,p),false);
});
test('initial load, stale or future snapshots, long monitoring gaps and repeated snapshots produce no historical burst',()=>{
 assert.deepEqual(deriveAlertEvents(null,feed('post'),[],now),[]);
 assert.deepEqual(deriveAlertEvents(old(),feed('post',8,-400000),[],now),[]);
 assert.deepEqual(deriveAlertEvents(old(),feed('post',8,60000),[],now),[]);
 assert.deepEqual(deriveAlertEvents(feed('pre',8,-400000),feed('post'),[],now),[]);
 assert.deepEqual(deriveAlertEvents(feed('post'),feed('post'),[],now),[]);
});
test('each newly published poll is independent; corrections to the same edition and missing polls do not notify',()=>{
 const events=deriveAlertEvents(old(),feed('pre',9),[],now);assert.deepEqual(events.map(e=>e.types),[['ap'],['coaches']]);
 const corrected=feed('pre');corrected.polls[0].teams.reverse();assert.equal(deriveAlertEvents(old(),corrected,[],now).length,0);
 const missing=feed('pre',9);missing.polls[0].teams=[];missing.polls[1].status='awaiting_update';assert.equal(deriveAlertEvents(old(),missing,[],now).length,0);
});
test('only confirmed, current, reviewed primary-source developments can notify',()=>{
 const n:ConfirmedDevelopment={id:'official-rules',title:'Confirmed change',summary:'Official report.',sourceUrl:'https://collegefootballplayoff.com/news/confirmed',confirmed:true,publishedAt:new Date(now-10000).toISOString(),verifiedAt:new Date(now-5000).toISOString()};
 assert.equal(verifiedDevelopment(n,now),true);
 for(const bad of [{confirmed:false},{sourceUrl:'https://collegefootballplayoff.com.evil.test/news'},{publishedAt:new Date(now+10000).toISOString()},{verifiedAt:'invalid'},{sourceUrl:'javascript:alert(1)'}])assert.equal(verifiedDevelopment({...n,...bad},now),false);
 assert.equal(deriveAlertEvents(old(),feed(),[n],now)[0].types[0],'development');
});
