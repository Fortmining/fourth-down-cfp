import {publishedEditionIdentity} from './edition-identity.ts';
import {hash} from './engine.ts';import {validFinal} from './ledger.ts';import type {Inputs} from './types';
import type {ResumePipeline} from './resume-pipeline.ts';
/** Private handoff candidate. Caller supplies already verified, already fetched inputs.
 * No timer, source fetch, notification import or production scheduler hook. */
export function confirmedResumeSignature(i:Inputs){return hash({season:i.season,overdue:i.games.filter(g=>!validFinal(g,Date.parse(i.observedAt))&&Date.parse(i.observedAt)-Date.parse(g.date)>8*3600000).map(g=>g.id),expiredEditions:i.editions.filter(e=>Date.parse(i.observedAt)-Date.parse(e.date)>8*86400000).map(e=>e.id+e.date),teams:i.teams.map(t=>({id:t.id,conference:t.conference,reportedRecord:t.reportedRecord,reportedConferenceRecord:t.reportedConferenceRecord})),finals:i.games.filter(g=>validFinal(g,Date.parse(i.observedAt))).map(g=>({id:g.id,teams:g.teams,scores:g.scores,winner:g.winner,conferenceGame:g.conferenceGame})),editions:i.editions.map(publishedEditionIdentity),coverage:i.coverage});}
export async function confirmedResumeHandoff(pipeline:ResumePipeline,previous:Inputs|null,current:Inputs,now:number,committed:{signature:string|null;status:string}|null=null){
 if(committed?.status==='ready'&&committed.signature===confirmedResumeSignature(current)&&previous&&confirmedResumeSignature(previous)===confirmedResumeSignature(current))return {status:'no-confirmed-change',updated:false,storeCalls:0,additionalSourceRequests:0};
 return {...await pipeline.tick(now),additionalSourceRequests:0};
}

export type VerifiedFeed={season:number|null;updatedAt:string;scoreboardAvailable?:boolean;sourceFetch?:{scoreboard:{policy:string;ok:boolean;responseReceivedAt?:string;ageSeconds?:number|null};rankings:{policy:string;ok:boolean;responseReceivedAt?:string;ageSeconds?:number|null}};games:{id:string;date:string;status:string;providerStatus?:string;completed?:boolean;teams:{id:string;score?:string;winner?:boolean}[]}[];polls:unknown[]};
/** Reads only the two feed objects already held by the notification dispatcher.
 * It does not import or run notification code, fetch sources, or spend Redis calls. */
export function verifiedFeedResumeGate(previous:VerifiedFeed|null,current:VerifiedFeed,now:number,engineCaughtUp=false){
 const trace=current.sourceFetch,at=Date.parse(current.updatedAt);
 if(!current.scoreboardAvailable||!current.season||!Number.isFinite(at)||at>now||now-at>360000||!trace||[trace.scoreboard,trace.rankings].some(t=>!t.ok||t.policy!=='no-store'||!t.responseReceivedAt||!Number.isFinite(Date.parse(t.responseReceivedAt))||Date.parse(t.responseReceivedAt)>now||now-Date.parse(t.responseReceivedAt)>360000||(t.ageSeconds??0)>30))return 'withheld';
 const identity=(f:VerifiedFeed)=>hash({season:f.season,polls:f.polls,finals:f.games.filter(g=>g.status==='post'&&g.completed===true&&/^STATUS_FINAL(?:_OT)?$/.test(g.providerStatus??'')&&g.teams.length===2&&g.teams.every(t=>/^\d{1,3}$/.test(t.score??''))&&g.teams[0].score!==g.teams[1].score).map(g=>({id:g.id,teams:g.teams})).sort((a,b)=>a.id.localeCompare(b.id))});
 return engineCaughtUp&&previous&&identity(previous)===identity(current)?'no-confirmed-change':'refresh';
}
