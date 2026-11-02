/** Read-only, one-game conditional arithmetic over an existing confirmed snapshot.
 * No simulated game is written into the confirmed ledger or official polls. */
import {explainGameOutcome} from './game-scenario-insights.ts';
type Result={gameId:string};
type Fixture={gameId:string;date:string;opponentId:string;conferenceGame:boolean};
export type ScenarioRow={conference?:string;conferencePosition?:string|number|null;conferenceLabel?:string;id:string;name:string;overall:string|null;conferenceRecord:string|null;wins:Result[];losses:Result[];remaining:Fixture[]};
export type ScenarioBaseline={season:number;at:string;snapshotId:string;issues:string[];rows:ScenarioRow[];officialEditions:{id:string;date:string;ranks:{id:string;rank:number}[]}[]};
const parsed=(s:unknown)=>typeof s==='string'&&/^\d{1,2}-\d{1,2}$/.test(s)?s.split('-').map(Number):null;
const unavailable=(reason:string)=>({status:'unavailable' as const,reason});
export function gameScenarios(view:ScenarioBaseline,gameId:string,now=Date.now()){
 if(!/^[1-9]\d{0,11}$/.test(gameId)||view?.season!==2026||!Number.isFinite(Date.parse(view.at))||Date.parse(view.at)>now||now-Date.parse(view.at)>7*86400000||!view.snapshotId||!Array.isArray(view.rows)||!Array.isArray(view.issues)||view.issues.length)return unavailable('A complete, dated 2026 snapshot is required.');
 if(view.rows.some(r=>!r||!Array.isArray(r.wins)||!Array.isArray(r.losses)||!Array.isArray(r.remaining)||[...r.wins,...r.losses,...r.remaining].some(g=>!g||typeof g.gameId!=='string'||!g.gameId)))return unavailable('Confirmed team evidence is incomplete.');
 if(view.rows.some(r=>[...(r.wins||[]),...(r.losses||[])].some(g=>g.gameId===gameId)))return unavailable('This game is already included in confirmed results. No hypothetical result is added again.');
 const rows=view.rows.filter(r=>r.remaining?.some(g=>g.gameId===gameId));
 if(rows.length!==2||rows[0].id===rows[1].id)return unavailable('The snapshot does not establish both sides of an uncounted fixture.');
 if(rows.some(r=>r.remaining.filter(g=>g.gameId===gameId).length!==1))return unavailable('Duplicate fixture evidence must be reconciled.');
 const fixtures=rows.map(r=>r.remaining.find(g=>g.gameId===gameId)!);
 if(fixtures.some((f,i)=>typeof f.conferenceGame!=='boolean'||f.opponentId!==rows[1-i].id||f.date!==fixtures[0].date||f.conferenceGame!==fixtures[0].conferenceGame)||!Number.isFinite(Date.parse(fixtures[0].date))||Date.parse(fixtures[0].date)<=Date.parse(view.at))return unavailable('Fixture evidence conflicts or predates the snapshot.');
 const records=rows.map(r=>parsed(r.overall));
 if(rows.some((r,i)=>!records[i]||!Array.isArray(r.wins)||!Array.isArray(r.losses)||r.wins.length!==records[i]![0]||r.losses.length!==records[i]![1]||new Set([...r.wins,...r.losses].map(g=>g.gameId)).size!==r.wins.length+r.losses.length))return unavailable('Confirmed result counts do not reconcile with both records.');
 const polls=(Array.isArray(view.officialEditions)?view.officialEditions:[]).filter(e=>e&&Array.isArray(e.ranks)&&['ap','coaches','cfp'].includes(e.id)&&Number.isFinite(Date.parse(e.date))&&Date.parse(e.date)<=Date.parse(view.at)&&(e.id!=='cfp'||Date.parse(view.at)>=Date.parse('2026-11-03T19:00:00-05:00')));
 return {status:'available' as const,hypothetical:true as const,gameId,date:fixtures[0].date,baselineAt:view.at,snapshotId:view.snapshotId,conferenceGame:fixtures[0].conferenceGame===true,
  teams:rows.map(r=>({id:r.id,name:r.name,baseline:r.overall,officialRanks:polls.flatMap(e=>{const rank=e.ranks.find(x=>x&&x.id===r.id&&Number.isInteger(x.rank)&&x.rank>=1&&x.rank<=25)?.rank;return rank?[{poll:e.id,rank,date:e.date}]:[];})})),
  outcomes:rows.map(winner=>({winnerId:winner.id,rows:rows.map((r,i)=>{const win=r.id===winner.id,[w,l]=records[i]!;const conference=parsed(r.conferenceRecord);const validConference=conference&&conference[0]<=w&&conference[1]<=l;return {id:r.id,name:r.name,outcome:win?'Win':'Loss',baseline:r.overall,after:`${w+(win?1:0)}-${l+(win?0:1)}`,baselineConference:r.conferenceRecord,afterConference:fixtures[0].conferenceGame&&validConference?`${conference[0]+(win?1:0)}-${conference[1]+(win?0:1)}`:null};})})),
  limitations:['Applies only this one hypothetical result to the dated snapshot; other games are held unchanged.','Official polls, confirmed records and resume positions are not changed.','No playoff berth, seed, championship spot or numerical probability is predicted.'],
 };
}
export type GameScenarioPacket=ReturnType<typeof confirmedGameScenarios>;

/** A checkpoint awaiting source reconciliation cannot support a fresh what-if display. */
export function confirmedGameScenarios(packet:{view?:ScenarioBaseline;pendingSourceReconciliation?:boolean}|null,gameId:string,now=Date.now()){
 if(packet?.pendingSourceReconciliation)return unavailable('Confirmed results are being reconciled. Try again after the next update.');
 if(!packet?.view)return unavailable('Confirmed snapshot unavailable. Try again later.');
 const result=gameScenarios(packet.view,gameId,now);
 if(result.status!=='available')return result;
 const view=packet.view;
 return {...result,outcomes:result.outcomes.map(o=>({...o,rows:o.rows.map(r=>{const team=view.rows.find(t=>t.id===r.id)!,opponent=view.rows.find(t=>result.teams.some(x=>x.id===t.id)&&t.id!==r.id)!;return {...r,insight:explainGameOutcome(view,team,opponent,r.id===o.winnerId,result.conferenceGame,gameId)};})}))};
}
