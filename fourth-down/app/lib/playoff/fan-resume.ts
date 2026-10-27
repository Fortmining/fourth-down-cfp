import type {Snapshot} from './types';
import {mergeLedger,validFinal} from './ledger.ts';
import {resumeView} from './resume-view.ts';

/** Fan-facing evidence summaries. These labels do not predict committee decisions. */
export function fanResume(current:Snapshot,previous?:Snapshot,now=new Date().toISOString()){
 const view=resumeView(current,previous,now),at=Date.parse(current.at);
 const names=new Map(current.inputs.teams.map(t=>[t.id,t.name]));
 const games=mergeLedger([],current.inputs.games).filter(g=>g.season===current.inputs.season);
 const rows=view.rows.map(row=>{
  const knownWins=row.wins.filter(w=>w.opponentStrength!==null&&w.opponentRecord!==null).sort((a,b)=>b.opponentStrength!-a.opponentStrength!);
  const knownLosses=row.losses.filter(w=>w.opponentStrength!==null&&w.opponentRecord!==null).sort((a,b)=>a.opponentStrength!-b.opponentStrength!);
  const strengths:string[]=[],weaknesses:string[]=[];
  if(row.overall!==null){
   if(row.losses.length===0&&row.wins.length)strengths.push(`Unbeaten in ${row.wins.length} confirmed games.`);
   else strengths.push(`${row.wins.length} confirmed ${row.wins.length===1?'win':'wins'}; ${row.losses.length} confirmed ${row.losses.length===1?'loss':'losses'}.`);
  }
  if(knownWins[0])strengths.push(`Leading win by opponent record: ${knownWins[0].opponent}, ${knownWins[0].score}.`);
  if(knownLosses[0])weaknesses.push(`Most costly loss by opponent record in this model: ${knownLosses[0].opponent} (${knownLosses[0].opponentRecord??'record unavailable'}), ${knownLosses[0].score}.`);
  if(row.losses.length>1)weaknesses.push(`${row.losses.length} losses reduce the confirmed win rate.`);
  if(row.wins.some(w=>w.opponentStrength===null||w.opponentRecord===null))weaknesses.push('Some wins have no verified opponent-strength comparison. Their strength is not invented.');
  if(!strengths.length)strengths.push('Not enough verified evidence to summarize resume strengths.');
  if(!weaknesses.length)weaknesses.push('No additional weakness is established by this limited comparison; this does not mean the resume has no weaknesses.');
  const remaining=games.filter(g=>g.teams.includes(row.id)&&!validFinal(g,at)&&g.state==='pre'&&!g.completed&&Date.parse(g.date)>at).map(g=>{
   const opponentId=g.teams.find(id=>id!==row.id)!;const peer=view.rows.find(r=>r.id===opponentId);
   return {gameId:g.id,date:g.date,...(g.kickoffTbd===undefined?{}:{kickoffTbd:g.kickoffTbd}),opponentId,opponent:names.get(opponentId)??'Opponent name unavailable',opponentRecord:peer?.overall??null,conferenceGame:g.conferenceGame,officialRanks:view.officialEditions.flatMap(e=>{const rank=e.ranks.find(r=>r.id===opponentId);return rank?[{poll:e.id,rank:rank.rank,date:e.date}]:[]}),importance:g.conferenceGame?'A result also changes the conference record; championship effects remain conditional.':'A result changes the overall record and opponent-based resume evidence.'};
  }).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  const pending=(current.inputs.pendingGames??[]).filter(g=>g.knownTeamIds.includes(row.id)&&Date.parse(g.date)>at);
  const old=previous?.rows.find(r=>r.id===row.id);
  const labels={W:'Win rate',R:'Results against opponents',S:'Opponent-record strength',P:'Published-ranking input'} as const;
  const drivers=view.comparison==='comparable'&&old?(['W','R','S','P'] as const).map(component=>({
   component,label:labels[component],change:current.weights[component]*((row.components[component]??0)-(old.components[component]??0)),
   availableBefore:old.components[component]!==null,availableNow:row.components[component]!==null,
  })):[];
  return {...row,strengths,weaknesses,drivers,remaining,pendingCount:pending.length,scheduleLabel:current.inputs.coverage.futureComplete?'Captured remaining schedule; opponents and times may change.':'Remaining schedule coverage is incomplete; these are known fixtures only.',remainingLabel:'Each confirmed result changes the resume. Opponent records provide context, not an estimate of playoff impact.'};
 });
 const selected:{id:string;label:string;context:string}[]=[];
 const add=(row:typeof rows[number]|undefined,label:string,context:string)=>{if(row&&!selected.some(s=>s.id===row.id))selected.push({id:row.id,label,context});};
 add(rows.find(r=>r.id==='2633'),'Tennessee','Requested team; captured facts and confirmed movement, when comparable.');
 add([...rows].filter(r=>(r.movement??0)>0&&(r.resumePosition??999)<=35).sort((a,b)=>b.movement!-a.movement!)[0],'Improving resume','Largest rise among the current top 35 in this confirmed replay; not a selection forecast.');
 add([...rows].filter(r=>(r.movement??0)<0&&(r.resumePosition??999)<=35).sort((a,b)=>a.movement!-b.movement!)[0],'Declining resume','Largest fall among the current top 35 in this confirmed replay; not an elimination claim.');
 add(rows.find(r=>r.conferencePosition===1&&r.overall!==null&&!selected.some(s=>s.id===r.id)),'Conference race','At the top by captured conference win percentage; championship eligibility and tiebreakers are not resolved.');
 add(rows.find(r=>r.resumePosition!==null&&r.resumePosition>=10&&r.resumePosition<=18&&!selected.some(s=>s.id===r.id)),'Bubble discussion example','Near the testing model’s cut-line region. This is a review example, not a verified playoff bubble or projected selection.');
 return {...view,rows,reviewTeams:selected};
}
