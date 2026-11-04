import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolvePac12} from '../app/lib/playoff/pac12.ts';
import {conferenceQualificationAudit} from '../app/lib/playoff/conference-audit.ts';
import type {Inputs,GameRevision,Edition} from '../app/lib/playoff/types.ts';
const at='2026-11-29T18:00:00Z';
function input(results:[string,string,string][]):Inputs {
 const ids=[...new Set(results.flatMap(([a,b])=>[a,b]))];
 return {season:2026,observedAt:at,teams:ids.map(id=>({id,name:'Synthetic '+id,conference:'9',eligible:true})),
 games:results.map(([a,b,winner],i)=>({id:String(i+100),season:2026,date:'2026-11-21T20:00Z',state:'post',completed:true,teams:[a,b],winner,scores:winner===a?[28,21]:[21,28],conferenceGame:true,period:4,clock:0,observedAt:at,source:'simulated regression fixture'})),
 editions:[],coverage:{complete:true,issues:[]},rulesVersion:'cfp-2026-unverified-conference-adapters'};
}
const done={conferenceSeasonComplete:true};
const rating={asOf:'2026-11-23T18:00Z',source:'https://sportsourceanalytics.com/fixture',metric:'team-rating' as const,direction:'higher' as const,values:{'1':3,'2':2,'3':1}};
function edition():Edition {return {id:'cfp',date:'2026-11-25T00:00Z',season:2026,ranks:Array.from({length:25},(_,i)=>({id:String(i+1),rank:i+1,previous:null,record:'unneeded'}))};}
test('Pac-12 excludes flex rematch and title Final from conference qualification and host order',()=>{
 const d=input([['1','2','1'],['1','3','1'],['2','3','2']]);
 const flex:GameRevision={...d.games[0],id:'401860926',date:'2026-11-28T20:00Z',winner:'2',scores:[14,31]};
 d.games.push(flex,{...flex,id:'401869542'});
 const r=resolvePac12(d,done);assert.deepEqual(r.issues,[]);assert.deepEqual(r.participants,['1','2']);assert.equal(r.host,'1');assert.equal(r.standings.find(t=>t.id==='1')!.wins,2);assert.equal(r.definitive,false);assert.equal(r.shadow,true);
});
test('multi-team circular tie uses official metric, then restarts for remaining berth',()=>{
 const d=input([['1','2','1'],['2','3','2'],['3','1','3']]);
 assert.deepEqual(resolvePac12(d,{...done,sportSource:rating}).participants,['1','2']);
 const missing=resolvePac12(d,done);assert.deepEqual(missing.participants,[]);assert.ok(missing.issues.some(i=>i.includes('team-rating unavailable')));
 const tied=resolvePac12(d,{...done,sportSource:{...rating,values:{'1':1,'2':1,'3':1}}});assert.ok(tied.issues.some(i=>i.includes('draw unresolved')));assert.equal(tied.host,null);
});
test('two-team fallback requires specific Tuesday CFP edition; stale/other/future polls cannot decide host',()=>{
 const d=input([['1','3','1'],['2','4','2']]);
 const valid={edition:edition(),source:'https://collegefootballplayoff.com/rankings'};
 assert.deepEqual(resolvePac12(d,{...done,cfpWeek13:valid}).participants,['1','2']);
 for(const patch of [{date:'2026-11-17T20:00Z'},{date:'2026-12-01T20:00Z'},{id:'ap' as const},{season:2025}]){
  const r=resolvePac12(d,{...done,cfpWeek13:{...valid,edition:{...edition(),...patch}},sportSource:rating});assert.equal(r.host,null);assert.ok(r.issues.some(i=>i.includes('Tuesday-before-week-13')));
 }
 const foreign=resolvePac12(d,{...done,cfpWeek13:{...valid,source:'https://example.com/rankings'}});assert.equal(foreign.host,null);
});
test('two-team comparison goes through next-highest common opponent groups before all-common',()=>{
 const d=input([['1','3','1'],['1','4','1'],['1','5','5'],['1','6','1'],['2','3','2'],['2','4','4'],['2','5','2'],['2','7','2'],['3','4','3'],['3','5','3'],['3','8','3'],['3','9','3'],['4','5','4']]);
 const r=resolvePac12(d,done);assert.deepEqual(r.participants,['1','2']);assert.equal(r.trace[0].step,'next-highest common opponent group');assert.equal(r.trace.some(s=>s.step==='all common conference opponents'),false);
});
test('unconfirmed completion, missing eligibility, malformed Final and stale metrics withhold qualification',()=>{
 const d=input([['1','2','1'],['1','3','1'],['2','3','2']]);
 for(const variant of [{...d,coverage:{complete:false,issues:[]}}, {...d,teams:d.teams.map(t=>({...t,eligible:null}))}, {...d,games:d.games.map(g=>({...g,completed:false}))}])assert.deepEqual(resolvePac12(variant,done).participants,[]);
 assert.deepEqual(resolvePac12(d,{conferenceSeasonComplete:false}).participants,[]);
 const tie=input([['1','2','1'],['2','3','2'],['3','1','3']]);
 for(const asOf of ['2026-11-01T00:00Z','2026-12-10T00:00Z','invalid'])assert.deepEqual(resolvePac12(tie,{...done,sportSource:{...rating,asOf}}).participants,[]);
 assert.deepEqual(resolvePac12({...d,season:2025},done).participants,[]);
});
test('private integration requires the full eight-team round robin and refuses a premature conference completion',()=>{
 const results:[string,string,string][]=[];
 for(let a=1;a<=8;a++)for(let b=a+1;b<=8;b++)results.push([String(a),String(b),String(a)]);
 const d=input(results);assert.deepEqual(conferenceQualificationAudit(d).pac12.participants,['1','2']);
 assert.equal(conferenceQualificationAudit(d).publicActivation,false);
 const missing={...d,games:d.games.slice(1)};assert.deepEqual(conferenceQualificationAudit(missing).pac12.participants,[]);
 const early={...d,observedAt:'2026-11-20T00:00Z'};assert.deepEqual(conferenceQualificationAudit(early).pac12.participants,[]);
});
