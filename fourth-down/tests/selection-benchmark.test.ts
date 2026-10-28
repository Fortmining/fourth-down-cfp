import {test} from 'node:test';import assert from 'node:assert/strict';
import {historicalFieldProxy,selectionMetrics,benchmarkSelection} from '../app/lib/playoff/selection-benchmark.ts';
import type {Inputs} from '../app/lib/playoff/types';
const teams=Array.from({length:20},(_,i)=>({id:String(i+1),name:'Team '+i,conference:['5','8','17','4','1','151','37','12','15'][i%9],eligible:null}));
const input:Inputs={season:2024,observedAt:'2024-11-01T00:00:00Z',teams,games:[],editions:[],coverage:{complete:true,issues:[]},rulesVersion:'historical-resume-no-qualification-v1'};
const order=teams.map(t=>t.id);
test('historical 2024 champion byes are distinct from 2025 straight seeding',()=>{
 const a=historicalFieldProxy(order,input),b=historicalFieldProxy(order,{...input,season:2025});
 assert.equal(a.seeds.length,12);assert.equal(new Set(a.seeds).size,12);assert.deepEqual(a.seeds.slice(0,4),a.champions.slice(0,4));assert.deepEqual(b.seeds,order.slice(0,12));
 const moved=['1','10','19',...order.filter(id=>!['1','10','19'].includes(id))];const c=historicalFieldProxy(moved,input);assert.notDeepEqual(c.seeds.slice(0,4),moved.slice(0,4));
 assert.equal(a.eligibilityAssumed,20);assert.equal(a.definitive,false);assert.throws(()=>historicalFieldProxy(order,{...input,season:2026}));
});
test('membership and seeding cannot hide a missing team behind perfect conditional errors',()=>{
 const actual=order.slice(0,12),p=[...actual.slice(0,11),'20'];const m=selectionMetrics(p,actual);assert.equal(m.selectedCorrect,11);assert.equal(m.conditionalSeedMAE,0);assert.equal(m.allActualSeedError,1);assert.deepEqual(m.missedSelections,['12']);assert.deepEqual(m.falseInclusions,['20']);assert.equal(m.byeTeamsCorrect,4);assert.equal(m.probabilitiesValidated,false);
 assert.throws(()=>selectionMetrics([...actual.slice(0,11),'1'],actual));
});
test('future labels and feature leakage are rejected; incomplete vintages excluded',()=>{
 const target={season:2024 as const,selectionDay:'2024-12-08',source:'https://collegefootballplayoff.com/news/2024/12/8/cfp-rankings-241208',seeds:order.slice(0,12)};
 assert.throws(()=>benchmarkSelection({...input,observedAt:target.selectionDay+'T00:00:00Z'},target));
 assert.throws(()=>benchmarkSelection({...input,editions:[{id:'cfp',season:2024,date:'2024-12-01T00:00Z',ranks:[]}]},target));
 assert.equal(benchmarkSelection({...input,coverage:{complete:false,issues:['missing']}},target).status,'excluded-incomplete');
 const before=JSON.stringify(input);const r=benchmarkSelection(input,target);assert.equal(r.models.length,10);assert.equal(JSON.stringify(input),before);
});
