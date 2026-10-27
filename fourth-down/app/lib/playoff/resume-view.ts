import {hash,runShadow} from './engine.ts';
import {currentRecords,validFinal,mergeLedger} from './ledger.ts';
import {validPublishedEdition} from './published-edition.ts';
import type {Snapshot,GameRevision} from './types';

const finalKey=(g:GameRevision)=>hash({teams:g.teams,scores:g.scores,winner:g.winner,conferenceGame:g.conferenceGame});
const conferences:Record<string,string>={'1':'ACC','4':'Big 12','5':'Big Ten','8':'SEC','9':'Pac-12','12':'Conference USA','15':'MAC','17':'Mountain West','18':'Independent','37':'Sun Belt','151':'American'};
/** Display adapter only. It never edits a published poll or approves a field. */
export function resumeView(current:Snapshot,previous?:Snapshot,now=new Date().toISOString()){
 if(current.mode!=='confirmed')throw Error('Confirmed resume baseline required');
 if(!Number.isFinite(Date.parse(now)))throw Error('Invalid display clock');
 if(current.inputHash!==hash(current.inputs)||(previous&&previous.inputHash!==hash(previous.inputs)))throw Error('Snapshot input identity mismatch');
 const input=current.inputs,at=Date.parse(current.at),clock=Date.parse(now);
 if(!Number.isFinite(at)||at>clock+30000)throw Error('Invalid/future resume snapshot');
 const finals=mergeLedger([],input.games).filter(g=>g.season===input.season&&validFinal(g,at));
 const records=currentRecords(input),names=new Map(input.teams.map(t=>[t.id,t.name]));
 const issues=[...input.coverage.issues];
 if(!input.coverage.complete)issues.push('Season ledger coverage incomplete; complete records and resume ordering withheld');
 if(Object.values(records).some(r=>r.status==='conflict'))issues.push('Current record sources disagree; resume ordering withheld');
 if(!current.anchorIds.length||current.issues.some(i=>/baseline|edition|anchor|ranking|poll/i.test(i)))issues.push('Published poll anchor unavailable or unverified; resume ordering withheld');
 const beforeFinals=previous?mergeLedger([],previous.inputs.games).filter(g=>g.season===previous.inputs.season&&validFinal(g,Date.parse(previous.at))):[];
 const removed=beforeFinals.filter(g=>!finals.some(n=>n.id===g.id));
 if(removed.length)issues.push('Previously confirmed results are absent; affected complete records and all movement withheld');
 const invalidFinals=input.games.filter(g=>g.season===input.season&&(g.completed||g.state==='post')&&!validFinal(g,at));
 if(invalidFinals.length)issues.push('Invalid final evidence; ordering and movement withheld');
 const supported=issues.length===0;
 let comparable=!!previous&&supported;
 if(previous&&(previous.mode!=='confirmed'||previous.modelVersion!==current.modelVersion||hash(previous.weights)!==hash(current.weights)||previous.rulesVersion!==current.rulesVersion||previous.inputs.season!==input.season||Date.parse(previous.at)>at||hash(previous.inputs.teams.map(t=>({id:t.id,conference:t.conference})))!==hash(input.teams.map(t=>({id:t.id,conference:t.conference})))||!previous.inputs.coverage.complete||!previous.anchorIds.length||previous.issues.some(i=>/baseline|edition|anchor|ranking|poll/i.test(i))||previous.inputs.games.some(g=>g.season===previous.inputs.season&&(g.completed||g.state==='post')&&!validFinal(g,Date.parse(previous.at)))||Object.values(currentRecords(previous.inputs)).some(r=>r.status==='conflict'))){comparable=false;issues.push('Prior snapshot is incompatible or incomplete; movement withheld');}
 const changed=finals.filter(g=>!beforeFinals.some(p=>p.id===g.id&&finalKey(p)===finalKey(g)));
 // The model is additive. Attribute the published-anchor component directly;
 // replaying an older poll at a later clock would incorrectly expire that anchor.
 // The residual includes confirmed ledger effects and at most score-rounding noise.
 const fresh=clock-at<=6*60000;
 const scenario=fresh&&supported?runShadow(input,current.weights,true,current.id,current.modelVersion):null;
 const latestEditions=['ap','coaches','cfp'].flatMap(id=>{const e=input.editions.filter(e=>e.id===id&&e.season===input.season&&Date.parse(e.date)<=at).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))[0];return e&&validPublishedEdition(e)?[e]:[];});
 const rows=current.rows.map(row=>{
  const t=input.teams.find(t=>t.id===row.id)!,record=records[row.id],old=previous?.rows.find(r=>r.id===row.id);
  const affectedMissing=removed.some(g=>g.teams.includes(row.id))||invalidFinals.some(g=>g.teams.includes(row.id));
  const recordComplete=input.coverage.complete&&record.status!=='conflict'&&!affectedMissing;
  const own=finals.filter(g=>g.teams.includes(row.id));
  const result=(g:GameRevision)=>({gameId:g.id,opponent:names.get(g.teams.find(id=>id!==row.id)!)||'Opponent name unavailable',outcome:g.winner===row.id?'Win':'Loss',score:g.scores[g.teams.indexOf(row.id)]+'–'+g.scores[1-g.teams.indexOf(row.id)],observedAt:g.observedAt,opponentRecord:records[g.teams.find(id=>id!==row.id)!]?.overall??null,opponentStrength:row.quality.find(q=>q.gameId===g.id)?.q??null,corrected:beforeFinals.some(p=>p.id===g.id&&finalKey(p)!==finalKey(g))});
  const reasons:{kind:'result'|'opponent'|'poll'|'relative';text:string;gameIds:string[]}[]=[];
  if(comparable&&old){
   for(const g of changed.filter(g=>g.teams.includes(row.id))){const r=result(g);reasons.push({kind:'result',text:`${r.corrected?'Corrected final':'Confirmed final'}: ${r.outcome.toLowerCase()} vs ${r.opponent}, ${r.score}.`,gameIds:[g.id]});}
   for(const q of row.quality){const prior=old.quality.find(p=>p.gameId===q.gameId);if(prior&&q.q!==null&&prior.q!==null&&q.q!==prior.q){const causes=changed.filter(g=>g.teams.includes(q.opponent)&&!g.teams.includes(row.id));if(causes.length)reasons.push({kind:'opponent',text:`${names.get(q.opponent)||'Opponent'} changed its confirmed record; the value of this earlier ${q.outcome} changed.`,gameIds:causes.map(g=>g.id)});}}
   if(Math.abs(current.weights.P*(row.components.P-old.components.P))>0.000001)reasons.push({kind:'poll',text:'A changed published poll anchor altered the independent resume score. This is separate from official poll movement.',gameIds:[]});
   if(row.position!==old.position&&Math.abs(row.score-old.score)<0.000001)reasons.push({kind:'relative',text:row.modelTie||old.modelTie?"Display order changed within tied model scores; this is not a measured gain in resume strength.":"Relative resume order changed while this team's own score stayed the same.",gameIds:changed.map(g=>g.id)});
  }
  const confMembers=input.teams.filter(x=>x.conference===t.conference),conferenceGames=record.conference.split('-').map(Number),played=conferenceGames[0]+conferenceGames[1];
  const conferenceComplete=input.coverage.complete&&confMembers.every(x=>records[x.id].status!=='conflict'&&!removed.some(g=>g.teams.includes(x.id))&&!invalidFinals.some(g=>g.teams.includes(x.id)));
  const confPosition=recordComplete&&conferenceComplete&&t.conference!=='18'&&played?1+confMembers.filter(x=>{const r=records[x.id],parts=r.conference.split('-').map(Number),n=parts[0]+parts[1];return n>0&&parts[0]/n>conferenceGames[0]/played;}).length:null;
  return {id:row.id,name:row.name,conference:conferences[t.conference]||'Conference '+t.conference,conferencePosition:confPosition,conferenceLabel:'Conference win percentage; tied places remain tied, not championship qualification',overall:recordComplete?record.overall:null,conferenceRecord:recordComplete?record.conference:null,ledgerRecord:record.overall,recordLabel:recordComplete?'Confirmed complete ledger':'Partial or conflicting ledger; complete record unavailable',resumePosition:supported&&own.length?row.position:null,modelTie:row.modelTie,score:supported&&own.length?row.score:null,components:row.components,strength:recordComplete&&row.components.S!==null?row.components.S:null,strengthLabel:'Independent smoothed opponent-record index; excludes untracked opponents, not official SOS or a probability',wins:own.filter(g=>g.winner===row.id).map(result),losses:own.filter(g=>g.winner!==row.id).map(result),movement:comparable&&old?old.position-row.position:null,scoreDelta:comparable&&old?row.score-old.score:null,attribution:comparable&&old?{resultAndLedger:(row.score-old.score)-current.weights.P*(row.components.P-old.components.P),pollAnchor:current.weights.P*(row.components.P-old.components.P),roundingTolerance:0.000001}:null,reasons,eligibility:t.eligible===true?'Institutional evidence recorded':t.eligible===false?'Recorded eligibility restriction':'Eligibility unresolved; no qualification claimed'};
 });
 return {schema:1,privatePreview:true,at:current.at,generatedAt:now,sourceInputHash:current.inputHash,snapshotId:current.id,previousAt:previous?.at??null,previousSnapshotId:previous?.id??null,modelVersion:current.modelVersion,weights:current.weights,freshness:fresh?'recent capture':'archived capture — not live',comparison:comparable?'comparable':previous?'withheld':'baseline only',issues:[...new Set(issues)],rows,officialEditions:latestEditions.map(e=>({id:e.id,date:e.date,ranks:e.ranks.map(r=>({id:r.id,rank:r.rank,movement:r.previous&&r.previous<=25?r.previous-r.rank:null}))})),liveScenario:scenario&&scenario.assumptions.length?{label:'Conditional: current verified leaders win; not a prediction',assumptions:scenario.assumptions,rows:scenario.rows.map(r=>({id:r.id,record:r.record,resumePosition:r.position}))}:null,scenarioUnavailable:fresh?'No supported live-leader assumptions available':'Capture is archived; live scenarios withheld',championshipScenario:{label:'Rule-only conditions, not predicted qualifiers',text:input.season===2026?'A verified Power Four championship winner with applicable eligibility receives protected access under the 2026 format. The highest-ranked eligible team from the other six conferences has protected access, and Notre Dame has its published top-12 protection. Unknown winners, rankings, eligibility and decisive tiebreakers stay unresolved; no qualifiers are named here.':input.season===2025?'Historical 2025 conditions: the five highest-ranked conference champions and next seven highest-ranked teams receive places. Seeding follows ranking order, with byes for seeds 1–4. No actual or predicted qualifiers are asserted in this replay.':input.season===2024?'Historical 2024 conditions: the five highest-ranked conference champions and next seven highest-ranked teams receive places. The four highest-ranked champions receive the first four seeds and byes; committee ranking order differs from bracket seeding. No qualifiers are asserted here.':'Verified qualification conditions unavailable for this season',qualifiedTeams:[]},projectedBracket:null,playoffProbabilities:null,publicActivation:false};
}
