import {validFinal,mergeLedger} from './ledger.ts';import {currentRecords} from './ledger.ts';import type {Inputs} from './types';
/** Diagnostic evidence only. These fixed cutoffs are not committee criteria or a scoring model. */
export function qualityEvidence(input:Inputs){
 const at=Date.parse(input.observedAt);if(!Number.isFinite(at))throw Error('Invalid as-of cutoff');
 if(input.games.some(g=>!Number.isFinite(Date.parse(g.observedAt))||Date.parse(g.observedAt)>at))throw Error('Future source observation');
 const finals=mergeLedger([],input.games).filter(g=>g.season===input.season&&validFinal(g,at)),ids=new Set(input.teams.map(t=>t.id)),records=currentRecords(input);
 return input.teams.map(t=>{
  const own=finals.filter(g=>g.teams.includes(t.id));
  const evidence=own.map(g=>{const opponent=g.teams.find(id=>id!==t.id)!,schedule=finals.filter(x=>x.teams.includes(opponent)&&!x.teams.includes(t.id)),n=schedule.length,w=schedule.filter(x=>x.winner===opponent).length,available=input.coverage.complete&&ids.has(opponent)&&records[opponent]?.status!=='conflict'&&n>=6;
   return {gameId:g.id,date:g.date,source:g.source,opponent,outcome:g.winner===t.id?'win':'loss',opponentWinsExcludingTeam:available?w:null,opponentGamesExcludingTeam:available?n:null,opponentWinRate:available?w/n:null,classification:!available?'unavailable':g.winner===t.id&&w/n>=0.75?'quality-win':g.winner!==t.id&&w/n<=0.25?'bad-loss':'other',basis:'Opponent record at the captured cutoff, excluding all head-to-head games; not opponent strength at kickoff.'};});
  const ready=input.coverage.complete&&records[t.id]?.status!=='conflict';
  return {id:t.id,status:ready?'available':'withheld',qualityWins:ready?evidence.filter(g=>g.classification==='quality-win').length:null,badLosses:ready?evidence.filter(g=>g.classification==='bad-loss').length:null,unavailable:evidence.filter(g=>g.classification==='unavailable').length,evidence,cutoff:input.observedAt,method:'quality-evidence-diagnostic-v1'};
 });
}
