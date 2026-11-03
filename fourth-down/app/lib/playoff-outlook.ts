import type {Poll} from './rankings';
import {evaluateSandbox,type SandboxCatalog} from './multi-game-sandbox.ts';
export type Outlook='Likely In'|'On the Bubble'|'Outside Looking In';
export const outlookBand=(rank:number|null):Outlook=>rank!==null&&rank<=8?'Likely In':rank!==null&&rank<=16?'On the Bubble':'Outside Looking In';
export const CFP_2026_PROTOCOL='https://collegefootballplayoff.com/sports/2016/10/24/selection-committee-protocol';
export type QualificationAssumptions={champions:Record<string,string>;eligibilityAssumed:boolean};
export function conferenceLabel(value:string){const names:Record<string,string>={'Atlantic Coast Conference':'ACC','Big Ten Conference':'Big Ten','Big 12 Conference':'Big 12','Southeastern Conference':'SEC','American Conference':'American','Mid-American Conference':'MAC','Mountain West Conference':'Mountain West','Pac-12 Conference':'Pac-12','Sun Belt - East':'Sun Belt','Sun Belt - West':'Sun Belt'};return names[value]||value;}
function usablePoll(p:Poll|undefined,now:number):p is Poll{return !!p&&p.season===2026&&!!p.date&&Number.isFinite(Date.parse(p.date))&&Date.parse(p.date)<=now&&['available','awaiting_update'].includes(p.status)&&(p.id!=='cfp'||(now>=Date.parse('2026-11-03T19:00:00-05:00')&&Date.parse(p.date)>=Date.parse('2026-11-03T00:00:00Z')));}
const power=['ACC','Big Ten','Big 12','SEC'],other=['American','Conference USA','MAC','Mountain West','Pac-12','Sun Belt'];
/** A conditional allocation, NOT a learned committee forecast. No invented game-driven rank jumps. */
export function referenceField(poll:Poll|undefined,conferences:Record<string,string>,assumptions:QualificationAssumptions){
 const withheld=(reason:string)=>({status:'withheld' as const,reason,teams:[] as {id:string;name:string;seed:number;rank:number;reason:string}[]});
 if(!usablePoll(poll,Date.now())||poll.teams.length!==25||new Set(poll.teams.map(t=>t.teamId)).size!==25||new Set(poll.teams.map(t=>t.rank)).size!==25||poll.teams.some(t=>!Number.isInteger(t.rank)||t.rank<1||t.rank>25))return withheld('A complete, untied published Top 25 is required for this reference field.');
 if(!assumptions.eligibilityAssumed)return withheld('Acknowledge that postseason eligibility is assumed for this illustration.');
 const order=[...poll.teams].sort((a,b)=>a.rank-b.rank),qualifiers:string[]=[];
 for(const conf of power){const id=assumptions.champions[conf];if(!id||conferences[id]!==conf)return withheld(`Choose a hypothetical ${conf} champion. Winning out does not establish a championship berth.`);if(!order.some(t=>t.teamId===id))return withheld('An assumed champion is outside the captured Top 25; its relative seeding is unknown.');qualifiers.push(id);}
 const representative=order.find(t=>other.includes(conferences[t.teamId]));if(!representative)return withheld('The required six-conference representative is not established by this Top 25.');qualifiers.push(representative.teamId);
 const selected=new Set(qualifiers);const nd=order.find(t=>t.teamId==='87');if(nd&&nd.rank<=12)selected.add(nd.teamId);
 for(const t of order){if(selected.size===12)break;selected.add(t.teamId);}
 const teams=order.filter(t=>selected.has(t.teamId)).map((t,i)=>({id:t.teamId,name:t.name,rank:t.rank,seed:i+1,reason:qualifiers.includes(t.teamId)?'Conditional automatic bid':t.teamId==='87'&&t.rank<=12?'Notre Dame top-12 rule':'Ranking-anchor at-large'}));
 return {status:'conditional' as const,reason:'2026 allocation under your champion/eligibility assumptions. Ranking order is held unchanged; this is not a forecast of future committee votes.',teams};
}
export function teamOutlook(c:SandboxCatalog,choices:{gameId:string;winnerId:string}[],teamId:string,poll:Poll|undefined,excluded:string[]=[],now=Date.now()){
 const team=c.teams.find(t=>t.id===teamId);if(!usablePoll(poll,now))return null;if(!team||!team.overall||!Number.isFinite(Date.parse(c.at))||Date.parse(c.at)>now||now-Date.parse(c.at)>7*86400000)return null;
 if(choices.some(p=>{const g=c.games.find(g=>g.id===p.gameId);return !g||Date.parse(g.date)<=now;}))return null;
 const rows=evaluateSandbox(c,choices,excluded),row=rows.find(r=>r.id===teamId),ranks=new Map(poll?.teams.map(t=>[t.teamId,t.rank])||[]),rank=ranks.get(teamId)??null;
 const games=c.games.filter(g=>g.teams.some(t=>t.id===teamId)&&!excluded.includes(g.id)&&Date.parse(g.date)>now),selected=games.filter(g=>choices.some(p=>p.gameId===g.id)),winsOut=games.length>0&&selected.length===games.length&&selected.every(g=>choices.some(p=>p.gameId===g.id&&p.winnerId===teamId));
 const peers=(poll?.teams||[]).filter(t=>t.teamId!==teamId&&t.rank>=9&&t.rank<=18).map(t=>({id:t.teamId,name:t.name,rank:t.rank,games:c.games.filter(g=>g.teams.some(p=>p.id===t.teamId)&&Date.parse(g.date)>now&&!excluded.includes(g.id)).slice(0,2)}));
 const rankedResults=c.teams.filter(p=>p.id!==teamId&&ranks.has(p.id)).flatMap(p=>{const beat=team.wins.filter(id=>p.losses.includes(id)),lost=team.losses.filter(id=>p.wins.includes(id));return [...beat.map(id=>({gameId:id,opponent:p.name,rank:ranks.get(p.id)!,result:'Win'})),...lost.map(id=>({gameId:id,opponent:p.name,rank:ranks.get(p.id)!,result:'Loss'}))];});
 const hypothetical=selected.map(g=>({gameId:g.id,opponent:g.teams.find(t=>t.id!==teamId)!,won:choices.find(p=>p.gameId===g.id)!.winnerId===teamId}));
 return {name:team.name,label:outlookBand(rank),rank,before:team.overall,after:row?.after||team.overall,conferenceBefore:team.conferenceRecord,conferenceAfter:row?.conferenceAfter||team.conferenceRecord,winsOut,remainingUnselected:games.length-selected.length,rankedResults,hypothetical,peers,opponentChanges:row?.opponentChanges||[],selectionGuaranteed:false,eliminated:false,
  headline:winsOut?`Winning out reaches ${row?.after||team.overall}. It does not by itself secure a playoff berth.`:'Choose results to compare the record and selection evidence.',
  why:rank===null?'Outside the captured Top 25 is a weaker starting point, not mathematical elimination.':`The ${poll?.name} anchor is #${rank}. This ${outlookBand(rank).toLowerCase()} estimate holds that ranking context fixed; it does not predict the committee’s reaction to future results.`,
  changes:row?.selectedResults.length?`${row.selectedResults.length} assumed result(s) change your record. Ranked opponents and their records explain the evidence; no validated conversion to future committee positions is available.`:'No selected result changes this team’s confirmed record.',
  limits:['Private prototype: these bands are descriptive ranking anchors, not calibrated selection probabilities.','Ranks 1–8 / 9–16 / 17+ are fixed structural bands, not thresholds tuned to Tennessee.','Schedule strength, player availability and championship tiebreakers are not fully modeled; a ranked loss is not automatically a quality loss.','Other results are held unchanged unless selected. Future committee judgment and championship qualification remain uncertain.']};
}

/** Exact rules sensitivity, not a learned ranking-change model or selection likelihood. */
export function rankingAssumptionPath(poll:Poll|undefined,conferences:Record<string,string>,assumptions:QualificationAssumptions,teamId:string){
 const base=referenceField(poll,conferences,assumptions);if(base.status!=='conditional'||!poll)return null;
 const current=[...poll.teams].sort((a,b)=>a.rank-b.rank),team=current.find(t=>t.teamId===teamId);if(!team)return null;
 if(base.teams.some(t=>t.id===teamId))return {alreadyIncluded:true,currentRank:team.rank,illustratedRank:team.rank,positions:0,entering:[] as string[],leaving:[] as string[],field:base.teams};
 for(let rank=team.rank-1;rank>=1;rank--){
  const order=current.filter(t=>t.teamId!==teamId);order.splice(rank-1,0,team);
  const next=referenceField({...poll,teams:order.map((t,i)=>({...t,rank:i+1}))},conferences,assumptions);
  if(next.status==='conditional'&&next.teams.some(t=>t.id===teamId))return {alreadyIncluded:false,currentRank:team.rank,illustratedRank:rank,positions:team.rank-rank,entering:next.teams.filter(t=>!base.teams.some(old=>old.id===t.id)).map(t=>t.name),leaving:base.teams.filter(t=>!next.teams.some(now=>now.id===t.id)).map(t=>t.name),field:next.teams};
 }
 return null;
}
