import {runShadow,candidates,hash} from './engine.ts';
import {mergeLedger,validFinal} from './ledger.ts';
import type {Inputs,Weights} from './types';
type Outcome={id:string;teams:[string,string];winner:string;conferenceGame:boolean;evidence:'confirmed'|'hypothetical'};
const mean=(a:number[])=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
const withheld=(reason:string)=>({status:'withheld' as const,reason,private:true as const,fieldWithheld:true as const});
/** Private counterfactual graph; never manufactures a score, final, timestamp, or ledger revision. */
export function conditionalResume(input:Inputs,gameId:string,winnerId:string,weights:Weights=candidates[0]){
 try{
 const cutoff=Date.parse(input.observedAt);
 if(input.games.some(g=>!Number.isFinite(Date.parse(g.observedAt))||Date.parse(g.observedAt)>cutoff))return withheld('A source observation postdates the scenario cutoff.');
 if(input.season===2026&&cutoff<Date.parse('2026-11-03T19:00:00-05:00')&&input.editions.some(e=>e.id==='cfp'&&e.season===2026))return withheld('The first official 2026 CFP release boundary has not been reached.');
 const baseline=runShadow(input,weights,false,null,'resume-shadow-v1.2.0');
 const blocking=baseline.issues.filter(i=>!i.startsWith('Future participants unresolved'));
 if(blocking.length)return withheld(blocking.join('; '));
 const epoch=Date.parse(input.observedAt),games=mergeLedger([],input.games).filter(g=>g.season===input.season),game=games.find(g=>g.id===gameId);
 if(!game||game.completed||game.state==='post'||game.winner!==null||game.teams.length!==2||game.teams[0]===game.teams[1]||!game.teams.includes(winnerId)||!game.teams.every(id=>input.teams.some(t=>t.id===id))||!Number.isFinite(Date.parse(game.date))||!Number.isFinite(Date.parse(game.observedAt))||Date.parse(game.observedAt)>epoch||typeof game.conferenceGame!=='boolean')return withheld('Requires an uncounted, source-observed fixture and one of its two supported teams.');
 const outcomes:Outcome[]=games.filter(g=>validFinal(g,epoch)).map(g=>({id:g.id,teams:g.teams,winner:g.winner!,conferenceGame:g.conferenceGame,evidence:'confirmed'}));
 const assumption:Outcome={id:game.id,teams:game.teams,winner:winnerId,conferenceGame:game.conferenceGame,evidence:'hypothetical'};
 const fbs=new Set(input.teams.map(t=>t.id));
 function evaluate(graph:Outcome[]){
  const totals=new Map<string,{w:number;n:number}>(),pairs=new Map<string,{w:number;n:number}>();
  for(const g of graph)for(const id of g.teams){const other=g.teams.find(t=>t!==id)!,t=totals.get(id)||{w:0,n:0},p=pairs.get(id+':'+other)||{w:0,n:0};t.n++;p.n++;if(g.winner===id){t.w++;p.w++;}totals.set(id,t);pairs.set(id+':'+other,p);}
  const strength=(id:string,excluding:string)=>{const t=totals.get(id)||{w:0,n:0},p=pairs.get(id+':'+excluding)||{w:0,n:0};return (t.w-p.w+1)/(t.n-p.n+2);};
  return input.teams.map(t=>{const own=graph.filter(g=>g.teams.includes(t.id)),wins=own.filter(g=>g.winner===t.id).length,conference=own.filter(g=>g.conferenceGame),cw=conference.filter(g=>g.winner===t.id).length;
   const quality=own.map(g=>{const opponent=g.teams.find(id=>id!==t.id)!,q=fbs.has(opponent)?strength(opponent,t.id):null,won=g.winner===t.id;return {gameId:g.id,opponent,q,contribution:q===null?(won?.25:-1):won?.5+.5*q:-(1-.5*q),evidence:g.evidence};});
   const S=mean(quality.flatMap(q=>q.q===null?[]:[q.q])),components={W:own.length?wins/own.length:0,R:((mean(quality.map(q=>q.contribution))??0)+1)/2,S,P:baseline.rows.find(r=>r.id===t.id)!.components.P};
   const score=Math.round((weights.W*components.W+weights.R*components.R+weights.S*(S??0)+weights.P*components.P)*1e6)/1e6;
   const remaining=games.filter(g=>g.state==='pre'&&g.id!==gameId&&g.teams.includes(t.id)).flatMap(g=>{const id=g.teams.find(id=>id!==t.id)!;return fbs.has(id)?[strength(id,t.id)]:[];});
   return {id:t.id,name:t.name,score,components,record:`${wins}-${own.length-wins}`,conferenceRecord:`${cw}-${conference.length-cw}`,quality,remainingDifficulty:input.coverage.futureComplete===false?null:mean(remaining)};
  });
 }
 const before=evaluate(outcomes),after=evaluate([...outcomes,assumption]);
 // A copied scorer must prove numerical parity with the frozen model before producing any scenario.
 if(before.some(r=>r.score!==baseline.rows.find(b=>b.id===r.id)?.score))return withheld('Counterfactual scorer differs from the frozen confirmed model.');
 const band=(rows:typeof before,score:number)=>({best:1+rows.filter(r=>r.score>score).length,worst:rows.filter(r=>r.score>=score).length});
 const rows=after.map(r=>{const old=before.find(b=>b.id===r.id)!,a=band(before,old.score),b=band(after,r.score),opponents=old.quality.filter(q=>q.q!==r.quality.find(x=>x.gameId===q.gameId)?.q).map(q=>q.opponent),reasons:string[]=[];
  if(game.teams.includes(r.id))reasons.push(`Assumed ${winnerId===r.id?'win':'loss'} in game ${gameId}; confirmed results unchanged.`);
  if(opponents.length)reasons.push('Prior opponents’ records changed under the assumption, affecting schedule and result quality.');
  if(!reasons.length&&(a.best!==b.best||a.worst!==b.worst))reasons.push('Other teams changed position under the same assumed result.');
  return {id:r.id,name:r.name,beforeScore:old.score,afterScore:r.score,scoreDelta:Math.round((r.score-old.score)*1e6)/1e6,beforeBand:a,afterBand:b,beforeRecord:old.record,afterRecord:r.record,conferenceRecord:r.conferenceRecord,components:r.components,remainingDifficulty:r.remainingDifficulty,affectedOpponents:opponents,reasons};});
 return {status:'available' as const,private:true as const,hypothetical:true as const,modelVersion:'conditional-resume-v0.1' as const,baselineSnapshotId:baseline.id,inputHash:hash(input),at:input.observedAt,weights,assumption,rows,officialPollsUnchanged:true as const,fieldWithheld:true as const,limitations:['Testing candidate, not a validated committee-selection forecast.','Position bands express tied scores, not playoff seeds or probabilities.','Conference records change; championship places, eligibility, tiebreakers and bracket allocation remain separate and unresolved.',...baseline.issues]};
 }catch{return withheld('Input evidence or model configuration is invalid.');}
}
export function conditionalSensitivity(input:Inputs,gameId:string,winnerId:string){
 const models=candidates.map(w=>conditionalResume(input,gameId,winnerId,w));
 return {private:true,fieldWithheld:true,label:'Sensitivity across fixed testing models; not selection likelihood',models};
}
