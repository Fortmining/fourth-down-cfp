import {publishedEditionIdentity} from './edition-identity.ts';
import {hash} from './engine.ts';import {gameFromEspn,editionsFromEspn,standingsTeams} from './espn.ts';
import {mergeLedger,validFinal} from './ledger.ts';import type {Inputs} from './types';import type {SourceCapture} from './resume-pipeline.ts';
/** Compose a complete season ledger with an already fetched ESPN feed. Zero new requests. */
export function captureResumeUpdate(seed:Inputs,scoreboard:any,observedAt:string,options:{rankings?:any;standings?:any}={}):SourceCapture{
 if(scoreboard.season?.year!==seed.season||!Array.isArray(scoreboard.events))throw Error('Wrong-season or missing ESPN scoreboard');
 const notes:string[]=[],incoming=[];const teams=options.standings?standingsTeams(options.standings):structuredClone(seed.teams);
 if(options.standings&&options.standings.season?.year!==seed.season)throw Error('Wrong-season standings');const seen=new Set<string>();
 for(const raw of scoreboard.events){
  if(seen.has(String(raw.id)))throw Error('Duplicate source event identity');seen.add(String(raw.id));
  const g=gameFromEspn(raw,seed.season,observedAt,'ESPN captured scoreboard',teams);
  if(!g){if(raw.status?.type?.state==='post'||raw.status?.type?.completed)throw Error('Unparseable source final');continue;}
  const old=seed.games.find(x=>x.id===g.id);if(old&&hash(old.teams)!==hash(g.teams))throw Error('Event participant order changed; verify source reconciliation');
  if(old&&validFinal(old)&&!validFinal(g)){notes.push('Ignored transient regression of confirmed game '+g.id);continue;}
  if((g.completed||g.state==='post')&&!validFinal(g,Date.parse(observedAt)))throw Error('Source final is not confirmed');incoming.push(g);
 }
 const affected=new Set(incoming.filter(g=>validFinal(g,Date.parse(observedAt))&&(!seed.games.some(old=>old.id===g.id&&validFinal(old)&&old.winner===g.winner&&hash(old.scores)===hash(g.scores)))).flatMap(g=>g.teams));
 if(!options.standings)for(const team of teams)if(affected.has(team.id)){
  // The archived seed retains its old aggregate. It predates this newly confirmed result.
  delete team.reportedRecord;delete team.reportedConferenceRecord;notes.push('Aggregate record not refreshed for '+team.id+'; current record derived from complete confirmed ledger');
 }
 const editions=structuredClone(seed.editions);if(options.rankings)for(const edition of editionsFromEspn(options.rankings,seed.season,observedAt)){
  if(edition.season!==seed.season)throw Error('Wrong-season poll');const same=editions.find(e=>e.id===edition.id&&e.date===edition.date);if(same&&publishedEditionIdentity(same)!==publishedEditionIdentity(edition))throw Error('Published edition changed under same identity');if(!same)editions.push(edition);
 }
 return {receivedAt:observedAt,sourceHashes:{seed:hash(seed),scoreboard:hash(scoreboard),...(options.rankings?{rankings:hash(options.rankings)}:{}),...(options.standings?{standings:hash(options.standings)}:{})},notes,inputs:{...structuredClone(seed),observedAt,teams,games:mergeLedger(seed.games,incoming),editions}};
}
