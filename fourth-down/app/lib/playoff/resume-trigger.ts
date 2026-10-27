import {publishedEditionIdentity} from './edition-identity.ts';
import {hash} from './engine.ts';import {validFinal} from './ledger.ts';import type {Inputs} from './types';
import type {ResumePipeline} from './resume-pipeline.ts';
/** Private handoff candidate. Caller supplies already verified, already fetched inputs.
 * No timer, source fetch, notification import or production scheduler hook. */
export function confirmedResumeSignature(i:Inputs){
 const epoch=Date.parse(i.observedAt);
 const games=i.games.map(g=>{const {observedAt,source,...facts}=g;void observedAt;void source;return validFinal(g,epoch)?facts:{...facts,state:'pre',completed:false,scores:[null,null],winner:null,period:null,clock:null};});
 return hash({...i,observedAt:undefined,games,editions:i.editions.map(publishedEditionIdentity),pendingGames:i.pendingGames?.map(({observedAt,source,...g})=>{void observedAt;void source;return g;}),overdue:i.games.filter(g=>!validFinal(g,epoch)&&epoch-Date.parse(g.date)>8*3600000).map(g=>g.id),expiredEditions:i.editions.filter(e=>epoch-Date.parse(e.date)>8*86400000).map(e=>e.id+e.date)});
}
export type ResumeCheckpoint={signature:string|null;status:string;checkedAt?:string|null};
// A result identity is not a freshness receipt. Only skip a capture already checked.
function checkedCapture(checkpoint:ResumeCheckpoint|null,current:Inputs,now:number){
 const checked=Date.parse(checkpoint?.checkedAt??''),observed=Date.parse(current.observedAt);
 return Number.isFinite(now)&&Number.isFinite(checked)&&Number.isFinite(observed)&&observed<=checked&&checked<=now&&now-checked<=360000;
}
export async function confirmedResumeHandoff(pipeline:ResumePipeline,previous:Inputs|null,current:Inputs,now:number,committed:ResumeCheckpoint|null=null){
 if(checkedCapture(committed,current,now)&&committed?.status==='ready'&&committed.signature===confirmedResumeSignature(current)&&previous&&confirmedResumeSignature(previous)===confirmedResumeSignature(current))return {status:'no-confirmed-change',updated:false,storeCalls:0,additionalSourceRequests:0};
 return {...await pipeline.tick(now),additionalSourceRequests:0};
}

export type VerifiedFeed={season:number|null;updatedAt:string;scoreboardAvailable?:boolean;sourceFetch?:{scoreboard:{policy:string;ok:boolean;responseReceivedAt?:string;ageSeconds?:number|null};rankings:{policy:string;ok:boolean;responseReceivedAt?:string;ageSeconds?:number|null}};games:{id:string;date:string;status:string;providerStatus?:string;completed?:boolean;teams:{id:string;score?:string;winner?:boolean}[]}[];polls:unknown[]};
/** Reads only the two feed objects already held by the notification dispatcher.
 * It does not import or run notification code, fetch sources, or spend Redis calls. */
export function verifiedFeedResumeGate(previous:VerifiedFeed|null,current:VerifiedFeed,now:number,engineCaughtUp=false,checkedAt:string|null=null){
 const trace=current.sourceFetch,at=Date.parse(current.updatedAt);
 if(!current.scoreboardAvailable||!current.season||!Number.isFinite(at)||at>now||now-at>360000||!trace||[trace.scoreboard,trace.rankings].some(t=>!t.ok||t.policy!=='no-store'||!t.responseReceivedAt||!Number.isFinite(Date.parse(t.responseReceivedAt))||Date.parse(t.responseReceivedAt)>now||now-Date.parse(t.responseReceivedAt)>360000||(t.ageSeconds??0)>30))return 'withheld';
 const identity=(f:VerifiedFeed)=>hash({season:f.season,polls:f.polls,finals:f.games.filter(g=>g.status==='post'&&g.completed===true&&/^STATUS_FINAL(?:_OT)?$/.test(g.providerStatus??'')&&g.teams.length===2&&g.teams.every(t=>/^\d{1,3}$/.test(t.score??''))&&g.teams[0].score!==g.teams[1].score).map(g=>({id:g.id,teams:g.teams})).sort((a,b)=>a.id.localeCompare(b.id))});
 // Feed equality cannot renew the independent engine's saved freshness.
 const checked=Date.parse(checkedAt??'');
 return engineCaughtUp&&Number.isFinite(checked)&&checked>=at&&checked<=now&&now-checked<=360000&&previous&&identity(previous)===identity(current)?'no-confirmed-change':'refresh';
}
