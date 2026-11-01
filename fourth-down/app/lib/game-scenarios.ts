/** Read-only, one-game conditional arithmetic over an existing confirmed snapshot.
 * No simulated game is written into the confirmed ledger or official polls. */
type Result={gameId:string};
type Fixture={gameId:string;date:string;opponentId:string;conferenceGame:boolean};
export type ScenarioRow={id:string;name:string;overall:string|null;conferenceRecord:string|null;wins:Result[];losses:Result[];remaining:Fixture[]};
export type ScenarioBaseline={season:number;at:string;snapshotId:string;issues:string[];rows:ScenarioRow[];officialEditions:{id:string;date:string;ranks:{id:string;rank:number}[]}[]};
const parsed=(s:unknown)=>typeof s==='string'&&/^\d{1,2}-\d{1,2}$/.test(s)?s.split('-').map(Number):null;
const unavailable=(reason:string)=>({status:'unavailable' as const,reason});
export function gameScenarios(view:ScenarioBaseline,gameId:string,now=Date.now()){
 if(!/^[1-9]\d{0,11}$/.test(gameId)||view?.season!==2026||!Number.isFinite(Date.parse(view.at))||Date.parse(view.at)>now||now-Date.parse(view.at)>7*86400000||!view.snapshotId||!Array.isArray(view.rows)||!Array.isArray(view.issues)||view.issues.length)return unavailable('A complete, dated 2026 snapshot is required.');
 if(view.rows.some(r=>[...(r.wins||[]),...(r.losses||[])].some(g=>g.gameId===gameId)))return unavailable('This game is already included in confirmed results. No hypothetical result is added again.');
 const rows=view.rows.filter(r=>r.remaining?.some(g=>g.gameId===gameId));
 if(rows.length!==2||rows[0].id===rows[1].id)return unavailable('The snapshot does not establish both sides of an uncounted fixture.');
 const fixtures=rows.map(r=>r.remaining.find(g=>g.gameId===gameId)!);
 if(fixtures.some((f,i)=>f.opponentId!==rows[1-i].id||f.date!==fixtures[0].date||f.conferenceGame!==fixtures[0].conferenceGame)||!Number.isFinite(Date.parse(fixtures[0].date))||Date.parse(fixtures[0].date)<=Date.parse(view.at))return unavailable('Fixture evidence conflicts or predates the snapshot.');
 const records=rows.map(r=>parsed(r.overall));
 if(rows.some((r,i)=>!records[i]||!Array.isArray(r.wins)||!Array.isArray(r.losses)||r.wins.length!==records[i]![0]||r.losses.length!==records[i]![1]||new Set([...r.wins,...r.losses].map(g=>g.gameId)).size!==r.wins.length+r.losses.length))return unavailable('Confirmed result counts do not reconcile with both records.');
 const polls=(view.officialEditions||[]).filter(e=>['ap','coaches','cfp'].includes(e.id)&&Number.isFinite(Date.parse(e.date))&&Date.parse(e.date)<=Date.parse(view.at));
 return {status:'available' as const,hypothetical:true as const,gameId,date:fixtures[0].date,baselineAt:view.at,snapshotId:view.snapshotId,conferenceGame:fixtures[0].conferenceGame===true,
  teams:rows.map(r=>({id:r.id,name:r.name,baseline:r.overall,officialRanks:polls.flatMap(e=>{const rank=e.ranks.find(x=>x.id===r.id)?.rank;return rank?[{poll:e.id,rank,date:e.date}]:[];})})),
  outcomes:rows.map(winner=>({winnerId:winner.id,rows:rows.map((r,i)=>{const win=r.id===winner.id,[w,l]=records[i]!;const conference=parsed(r.conferenceRecord);const validConference=conference&&conference[0]<=w&&conference[1]<=l;return {id:r.id,name:r.name,outcome:win?'Win':'Loss',baseline:r.overall,after:`${w+(win?1:0)}-${l+(win?0:1)}`,baselineConference:r.conferenceRecord,afterConference:fixtures[0].conferenceGame&&validConference?`${conference[0]+(win?1:0)}-${conference[1]+(win?0:1)}`:null};})})),
  limitations:['Applies only this one hypothetical result to the dated snapshot; other games are held unchanged.','Official polls, confirmed records and resume positions are not changed.','No playoff berth, seed, championship spot or numerical probability is predicted.'],
 };
}
export type GameScenarioPacket=ReturnType<typeof gameScenarios>;
