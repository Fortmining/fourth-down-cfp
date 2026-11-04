import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planShadowWrites} from '../app/lib/playoff/write-budget.ts';
import {applyEligibility,eligibilityCoverage,type EligibilityEvidence} from '../app/lib/playoff/eligibility.ts';
const receipt={observedAt:'2026-10-26T16:00Z',monthlyLimit:500000,commandsUsed:60000,daysRemaining:6,storageUsedBytes:15000000,storageLimitBytes:250000000,
 dailyUsage:Array.from({length:7},(_,i)=>({day:'2026-10-'+String(19+i),commands:i===5?19000:8000,complete:true}))};
test('write plan uses complete weekday observations, reserves polling reads and twenty commands per pair including retention/retry reserve',()=>{
 const p=planShadowWrites(receipt,27000,50);assert.equal(p.weeklyPatternObserved,true);assert.equal(p.completeUsageDays,7);
 assert.equal(p.periodicReadCommandsReserved,2160);assert.equal(p.commandsPerPair,20);assert.equal(p.productionActivationPermitted,false);assert.equal(p.transportInstalled,false);
 assert.ok(p.maxPairsWithinEstimatedHeadroom<=Math.floor(p.storageReserveBytes/(27000+512)));
});
test('partial days, missing weekends and stale observations cannot establish a sustainable production budget',()=>{
 const missing=planShadowWrites({...receipt,dailyUsage:receipt.dailyUsage.slice(0,3)},27000,50);assert.equal(missing.weeklyPatternObserved,false);
 const partial=planShadowWrites({...receipt,dailyUsage:[...receipt.dailyUsage,{day:'2026-10-26',commands:100,complete:true}]},27000,50);assert.ok(partial.issues.some(i=>i.includes('still in progress')));assert.equal(partial.completeUsageDays,7);
 const stale=planShadowWrites({...receipt,observedAt:'2026-11-03T16:00Z'},27000,50);assert.ok(stale.issues.some(i=>i.includes('stale')));
});
test('budget exhaustion, malformed samples and storage growth fail closed',()=>{
 assert.equal(planShadowWrites({...receipt,commandsUsed:400000},27000,50).maxPairsWithinEstimatedHeadroom,0);
 assert.equal(planShadowWrites({...receipt,storageUsedBytes:200000000},27000,50).maxPairsWithinEstimatedHeadroom,0);
 assert.throws(()=>planShadowWrites({...receipt,dailyUsage:[receipt.dailyUsage[0],receipt.dailyUsage[0]]},27000,1));
 assert.throws(()=>planShadowWrites({...receipt,dailyUsage:[{day:'2026-11-01',commands:1,complete:true}]},27000,1));
 assert.throws(()=>planShadowWrites(receipt,NaN,1));assert.throws(()=>planShadowWrites(receipt,27000,Number.MAX_SAFE_INTEGER));
});
test('bowl-only and conference evidence never silently grant universal institutional eligibility',()=>{
 const teams=[{id:'84',name:'Synthetic program',conference:'5',eligible:null}],at='2026-10-26T16:00Z';
 const row:EligibilityEvidence={id:'84',season:2026,status:'eligible',source:'https://example.edu/announcement',publishedAt:'2026-10-20T12:00Z',observedAt:'2026-10-26T15:00Z',reason:'simulated evidence',scope:'bowl'};
 assert.equal(applyEligibility(teams,[row],2026,at).teams[0].eligible,null);
 const audit=eligibilityCoverage(teams,[row],2026,at);assert.equal(audit.rows[0].evidence.find(e=>e.scope==='bowl')!.status,'eligible');assert.equal(audit.institutionalVerified,0);
 assert.equal(eligibilityCoverage(teams,[{...row,observedAt:'2026-10-27T12:00Z'}],2026,at).rows[0].evidence.find(e=>e.scope==='bowl')!.status,'unresolved');
 assert.equal(applyEligibility(teams,[{...row,scope:'institutional'}],2026,at).teams[0].eligible,true);
});

test('public-view cache misses consume the same shared quota and cannot be treated as free',()=>{const noVisitors=planShadowWrites({...receipt,storageUsedBytes:0,visitorReadReserve:0},100,1);const visitors=planShadowWrites({...receipt,storageUsedBytes:0,visitorReadReserve:200000},100,1);assert.equal(visitors.visitorReadCommandsReserved,200000);assert.ok(visitors.maxPairsWithinEstimatedHeadroom<noVisitors.maxPairsWithinEstimatedHeadroom);assert.throws(()=>planShadowWrites({...receipt,visitorReadReserve:-1},100,1));});
