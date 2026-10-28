import {hash,runShadow,candidates} from './engine.ts';
import {colleyReference} from './colley-reference.ts';
import type {Inputs} from './types';

export type SelectionTarget={season:2024|2025;selectionDay:string;source:string;seeds:string[]};
const historicalConferences=new Set(['1','4','5','8','151','12','15','17','37']);

/** Frozen experimental champion proxy, NOT verified championship qualification.
 * All ranking controls use the same proxy; future actual champions are never inputs.
 * This historical 5+7 allocator is deliberately separate from the 2026 allocator.
 */
export function historicalFieldProxy(order:string[],input:Inputs){
 if(![2024,2025].includes(input.season))throw Error('Historical formats only');
 if(new Set(order).size!==order.length||order.some(id=>!input.teams.some(t=>t.id===id)))throw Error('Invalid ranking identities');
 const leaders=new Map<string,string>();
 for(const id of order){const t=input.teams.find(t=>t.id===id)!;if(t.eligible===false)continue;if(historicalConferences.has(t.conference)&&!leaders.has(t.conference))leaders.set(t.conference,id);}
 const eligibleOrder=order.filter(id=>input.teams.find(t=>t.id===id)!.eligible!==false);
 const champions=eligibleOrder.filter(id=>[...leaders.values()].includes(id)).slice(0,5);
 if(champions.length!==5||eligibleOrder.length<12)throw Error('Incomplete historical proxy universe');
 const selected=new Set(champions);
 for(const id of eligibleOrder){if(selected.size===12)break;selected.add(id);}
 const byes=input.season===2024?champions.slice(0,4):[];
 const seeds=[...byes,...eligibleOrder.filter(id=>selected.has(id)&&!byes.includes(id))];
 return {seeds,champions,qualification:'highest-ordered-team-per-conference proxy; not a title forecast',eligibilityAssumed:input.teams.filter(t=>t.eligible===null).length,definitive:false};
}

/** Selection membership, conditional seeding, and bye/host accuracy remain distinct. */
export function selectionMetrics(predicted:string[],actual:string[]){
 if([predicted,actual].some(a=>a.length!==12||new Set(a).size!==12||a.some(id=>!id)))throw Error('Require twelve unique seeded teams');
 const common=predicted.filter(id=>actual.includes(id));
 const matching=(start:number,end:number)=>predicted.slice(start,end).filter(id=>actual.slice(start,end).includes(id)).length;
 const errors=common.map(id=>Math.abs(predicted.indexOf(id)-actual.indexOf(id)));
 return {selectedCorrect:common.length,fieldSize:12,precision:common.length/12,recall:common.length/12,
  falseInclusions:predicted.filter(id=>!actual.includes(id)),missedSelections:actual.filter(id=>!predicted.includes(id)),
  exactSeedMatches:common.filter(id=>predicted.indexOf(id)===actual.indexOf(id)).length,
  conditionalSeedMAE:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,conditionalSeedCount:common.length,
  // Penalizes missing selections rather than allowing a perfect conditional MAE to mask them.
  allActualSeedError:(errors.reduce((a,b)=>a+b,0)+(12-common.length)*12)/12,
  byeTeamsCorrect:matching(0,4),homeFirstRoundTeamsCorrect:matching(4,8),probabilitiesValidated:false};
}
export function benchmarkSelection(input:Inputs,target:SelectionTarget){
 const at=Date.parse(input.observedAt),publication=Date.parse(target.selectionDay+"T00:00:00Z");
 if(input.season!==target.season||!Number.isFinite(at)||!Number.isFinite(publication)||at>=publication||!/^https:\/\/collegefootballplayoff\.com\//.test(target.source))throw Error('Invalid selection target/cutoff');
 if(!input.coverage.complete)return {status:'excluded-incomplete',asOf:input.observedAt,models:[]};
 if(input.games.some(g=>!Number.isFinite(Date.parse(g.date))||!Number.isFinite(Date.parse(g.observedAt))||Date.parse(g.observedAt)>at||(g.completed&&Date.parse(g.date)>at))||input.editions.some(e=>e.season!==input.season||!Number.isFinite(Date.parse(e.date))||Date.parse(e.date)>at-86400000))throw Error('Future input leakage');
 // Generate every ordering from the frozen earlier inputs before reading target seeds.
 const snapshots=candidates.map(w=>runShadow(input,w,false,null,'resume-shadow-v1.2.0'));
 const baseline=snapshots[0];
 const valueOrder=(key:'W'|'P')=>[...baseline.rows].sort((a,b)=>b.components[key]-a.components[key]||Number(a.id)-Number(b.id)).map(t=>t.id);
 const controls=[{id:'colley-fbs-reference',order:colleyReference(input).rows.map(t=>t.id)},
  {id:'current-win-percentage',order:valueOrder('W')},
  {id:'published-poll-anchor',order:valueOrder('P')}];
 const forecasts=[...snapshots.map(s=>({id:s.weights.id,order:s.rows.map(t=>t.id),snapshotId:s.id})),...controls.map(c=>({...c,snapshotId:null}))].map(m=>({...m,forecast:historicalFieldProxy(m.order,input)}));
 return {status:'retrospective-proxy-backtest',season:input.season,asOf:input.observedAt,inputHash:hash(input),
  modelVersion:'resume-shadow-v1.2.0',leadDays:(publication-at)/86400000,targetSource:target.source,
  models:forecasts.map(m=>({id:m.id,snapshotId:m.snapshotId,forecast:m.forecast,metrics:selectionMetrics(m.forecast.seeds,target.seeds)})),
  limitations:['Conditional champion/eligibility proxy, not validated conference qualification','Historical features were archived; algorithm was developed later, not a contemporaneous prediction','Overlapping windows in only two seasons are not independent trials','No game-prediction metric establishes selection or seeding accuracy','No production activation or probability claim']};
}
