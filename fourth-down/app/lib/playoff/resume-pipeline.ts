import {publishedEditionIdentity} from './edition-identity.ts';
import {confirmedResumeSignature} from './resume-trigger.ts';
import {gunzipSync} from 'node:zlib';
import {hash,runShadow,candidates} from './engine.ts';
import {currentRecords,validFinal} from './ledger.ts';
import {validPublishedEdition} from './published-edition.ts';
import {packSnapshotPair,replaySnapshotPair} from './storage-plan.ts';
import {fanResume} from './fan-resume.ts';
import type {Inputs} from './types';

/** Private integration candidate: no network transport, production route or schedule. */
export const pipelineLimits=Object.freeze({history:32,historyBytes:4*1024*1024,stateBytes:8*1024*1024,cacheMs:15*60000,sourceAgeMs:6*60000,dayCommands:5000,dayMutations:2500,dayTicks:400,dayUpdates:60,dayCacheMisses:300,monthlyCommands:100000,monthlyMutations:50000,deadlineMs:15000,displayRequestsPerMinute:60,displayBytesPerMinute:16*1024*1024});
export type SourceCapture={inputs:Inputs;receivedAt:string;sourceHashes:Record<string,string>;notes?:string[]};
export type ResumeSource={read:(signal:AbortSignal)=>Promise<SourceCapture>};
type View=ReturnType<typeof fanResume>;
type Entry={id:string;semantic:string;at:string;encoded:string;sourceHashes:Record<string,string>;notes:string[]};
type Counters={commands:number;mutations:number;ticks:number;updates:number;cacheMisses:number};
export type PipelineState={schema:1;revision:number;season:number|null;sourceSignature:string|null;checkedAt:string|null;status:string;issues:string[];history:Entry[];view:View|null;cacheExpiresAt:number;day:string;month:string;daily:Counters;monthly:Counters};
export type SharedResumeDisplay={schema:1;revision:number;sourceSignature:string|null;checkedAt:string|null;status:string;issues:string[];view:View|null;history:{id:string;at:string}[]};
export type ResumeStore={renewVerifiedFreshness?:(signature:string,checkedAt:string)=>Promise<boolean>;readDisplay?:()=>Promise<SharedResumeDisplay|null>;transaction:<T>(operation:(state:PipelineState)=>T)=>Promise<T>};
export const emptyPipelineState=():PipelineState=>({schema:1,revision:0,season:null,sourceSignature:null,checkedAt:null,status:'unavailable',issues:['No confirmed update available'],history:[],view:null,cacheExpiresAt:0,day:'',month:'',daily:{commands:0,mutations:0,ticks:0,updates:0,cacheMisses:0},monthly:{commands:0,mutations:0,ticks:0,updates:0,cacheMisses:0}});
export class OperatingLimit extends Error{}
function charge(s:PipelineState,now:number,kind:'tick'|'update'|'cache'){
 const date=new Date(now).toISOString(),day=date.slice(0,10),month=date.slice(0,7);
 if(s.day&&day<s.day)throw new OperatingLimit('Operating clock regressed');
 if(s.day!==day){s.day=day;s.daily={commands:0,mutations:0,ticks:0,updates:0,cacheMisses:0};}
 if(s.month!==month){s.month=month;s.monthly={commands:0,mutations:0,ticks:0,updates:0,cacheMisses:0};}
 const commands=kind==='update'?24:kind==='cache'?12:6,mutations=kind==='update'?14:kind==='cache'?6:3;
 if(s.daily.commands+commands>pipelineLimits.dayCommands||s.monthly.commands+commands>pipelineLimits.monthlyCommands||s.daily.mutations+mutations>pipelineLimits.dayMutations||s.monthly.mutations+mutations>pipelineLimits.monthlyMutations||kind==='tick'&&s.daily.ticks>=pipelineLimits.dayTicks||kind==='update'&&s.daily.updates>=pipelineLimits.dayUpdates||kind==='cache'&&s.daily.cacheMisses>=pipelineLimits.dayCacheMisses)throw new OperatingLimit('Private operating allowance exhausted');
 for(const c of [s.daily,s.monthly]){c.commands+=commands;c.mutations+=mutations;if(kind==='tick')c.ticks++;if(kind==='update')c.updates++;if(kind==='cache')c.cacheMisses++;}
}
const resultKey=(g:Inputs['games'][number])=>hash({id:g.id,teams:g.teams,date:g.date,scores:g.scores,winner:g.winner,conferenceGame:g.conferenceGame});
export function validateCapture(c:SourceCapture,prior:Inputs|undefined,now:number){
 const i=c.inputs,epoch=Date.parse(i.observedAt),received=Date.parse(c.receivedAt);
 if(!Number.isFinite(now)||!Number.isFinite(epoch)||!Number.isFinite(received)||epoch>received||received>now||now-epoch>pipelineLimits.sourceAgeMs)throw Error('Source capture stale, invalid or future-dated');
 if(!Object.keys(c.sourceHashes).length||Object.keys(c.sourceHashes).length>32||Object.values(c.sourceHashes).some(x=>!/^[a-f0-9]{64}$/.test(x)))throw Error('Source content identities missing');
 if(i.teams.length<25||i.teams.length>200||i.games.length>2500||i.editions.length>64||!i.coverage.complete||i.coverage.issues.length)throw Error('Incomplete or oversized season ledger');
 if(new Set(i.teams.map(t=>t.id)).size!==i.teams.length)throw Error('Duplicate team identities');
 const ids=new Set<string>();for(const g of i.games){
  if(ids.has(g.id))throw Error('Duplicate game revisions in one capture');ids.add(g.id);
  if(g.season!==i.season||!Number.isFinite(Date.parse(g.observedAt))||Date.parse(g.observedAt)>epoch||!Number.isFinite(Date.parse(g.date))||g.teams.length!==2||g.teams[0]===g.teams[1])throw Error('Invalid game identity or observation');
  if((g.state==='post'||g.completed)&&!validFinal(g,epoch))throw Error('Invalid confirmed final');
  const teams=g.teams.map(id=>i.teams.find(t=>t.id===id));if(g.conferenceGame&&(!teams[0]||!teams[1]||teams[0].conference==='18'||teams[0].conference!==teams[1].conference))throw Error('Conflicting conference evidence');
 }
 if(i.games.some(g=>!validFinal(g,epoch)&&epoch-Date.parse(g.date)>8*3600000))throw Error('Overdue unconfirmed game; record coverage uncertain');
 for(const e of i.editions){if(e.season!==i.season||!Number.isFinite(Date.parse(e.date))||Date.parse(e.date)>epoch||!validPublishedEdition(e))throw Error('Invalid published edition');}
 const latest=(id:string)=>i.editions.filter(e=>e.id===id).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))[0];const anchors=latest('cfp')?[latest('cfp')!]:[latest('ap'),latest('coaches')].filter(Boolean);if(!anchors.length||anchors.some(e=>epoch-Date.parse(e!.date)>8*86400000))throw Error('Published baseline missing or expired');
 if(prior){
  for(const id of ['ap','coaches','cfp']){const old=prior.editions.filter(e=>e.id===id).map(e=>Date.parse(e.date));const next=i.editions.filter(e=>e.id===id).map(e=>Date.parse(e.date));if(old.length&&(!next.length||Math.max(...next)<Math.max(...old)))throw Error('Published baseline regressed');}
  if(prior.season!==i.season)throw Error('Season rollover requires an explicit new private store');
  if(epoch<Date.parse(prior.observedAt))throw Error('Delayed capture predates confirmed head');
  if(hash(prior.teams.map(t=>({id:t.id,conference:t.conference})))!==hash(i.teams.map(t=>({id:t.id,conference:t.conference}))))throw Error('Team/conference universe changed; explicit rebaseline required');
  for(const old of prior.editions){const same=i.editions.find(e=>e.id===old.id&&e.date===old.date);if(same&&publishedEditionIdentity(same)!==publishedEditionIdentity(old))throw Error('Historical published edition changed');}
  for(const old of prior.games.filter(g=>validFinal(g,Date.parse(prior.observedAt)))){const next=i.games.find(g=>g.id===old.id);if(!next||!validFinal(next,epoch)||hash(next.teams)!==hash(old.teams)||next.date!==old.date)throw Error('Confirmed result missing or regressed');if(resultKey(next)!==resultKey(old)&&Date.parse(next.observedAt)<=Date.parse(old.observedAt))throw Error('Conflicting final lacks newer source evidence');}
 }
 if(Object.values(currentRecords(i)).some(r=>r.status==='conflict'))throw Error('Reported records conflict with confirmed game ledger');
}
function confirmedInput(input:Inputs):Inputs{
 // Limited Resume release excludes live leader assumptions. Preserve confirmed finals only.
 return {...structuredClone(input),games:input.games.map(g=>validFinal(g,Date.parse(input.observedAt))?structuredClone(g):{...structuredClone(g),state:'pre',completed:false,scores:[null,null],winner:null,period:null,clock:null})};
}
function semantic(i:Inputs){return hash({model:'resume-shadow-v1.2.0',weights:candidates[0],...i,observedAt:undefined,games:i.games.map(({observedAt,source,...g})=>{void observedAt;void source;return g;}),pendingGames:i.pendingGames?.map(({observedAt,source,...g})=>{void observedAt;void source;return g;})});}
function receiptInputs(e:Entry):Inputs{if(hash({encoded:e.encoded,sourceHashes:e.sourceHashes,notes:e.notes})!==e.id)throw Error('Stored receipt identity mismatch');const packed=JSON.parse(gunzipSync(Buffer.from(e.encoded,'base64'),{maxOutputLength:2*1024*1024}).toString());if(packed.schema!==1||packed.modelVersion!=='resume-shadow-v1.2.0'||semantic(packed.inputs)!==e.semantic)throw Error('Stored input identity mismatch');return packed.inputs;}
function restore(e:Entry){const pair=replaySnapshotPair(e.encoded);if(hash({encoded:e.encoded,sourceHashes:e.sourceHashes,notes:e.notes})!==e.id||pair.confirmed.at!==e.at||semantic(pair.confirmed.inputs)!==e.semantic)throw Error('Stored resume receipt failed integrity check');return pair.confirmed;}
function render(s:PipelineState,now:number){const newest=s.history.at(-1);if(!newest)return null;const current=restore(newest),old=s.history.at(-2);return fanResume(current,old?restore(old):undefined,new Date(now).toISOString());}
export class ResumePipeline{
 private busy=false;
 private traffic={minute:-1,requests:0,bytes:0};
 private cache:{revision:number;from:number;until:number;value:unknown}|null=null;
 readonly store:ResumeStore;readonly source:ResumeSource;readonly elapsedNow:()=>number;
 constructor(store:ResumeStore,source:ResumeSource,elapsedNow=()=>performance.now()){this.store=store;this.source=source;this.elapsedNow=elapsedNow;}
 /** Already-captured, fully validated input only. No fetch, timer or production hook. */
 async ingest(capture:SourceCapture,now=Date.now()){
  if(this.store.renewVerifiedFreshness){
   try{validateCapture(capture,undefined,now);}catch{return this.tick(now,capture);}
   try{
    if(await this.store.renewVerifiedFreshness(confirmedResumeSignature(capture.inputs),capture.inputs.observedAt)){
     this.cache=null;return {status:'unchanged',updated:false,compactFreshness:true};
    }
   }catch{this.cache=null;return {status:'freshness-unavailable',updated:false};} // No hidden retry after quota/network ambiguity.
  }
  return this.tick(now,capture);
 }
 async tick(now=Date.now(),captured?:SourceCapture){
  if(this.busy)return {status:'busy',updated:false};this.busy=true;const started=this.elapsedNow();let expectedRevision:number|null=null,candidateSignature:string|null=null;
  try{
   const base=await this.store.transaction(s=>{charge(s,now,'tick');return {revision:s.revision,prior:s.history.at(-1)?receiptInputs(s.history.at(-1)!):undefined};});
   expectedRevision=base.revision;
   let capture:SourceCapture;
   try{const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;try{capture=await Promise.race([(captured?Promise.resolve(captured):this.source.read(abort.signal)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(new OperatingLimit('Source deadline exceeded'));},pipelineLimits.deadlineMs);})]);}finally{if(timer)clearTimeout(timer);abort.abort();}validateCapture(capture,base.prior,now);}catch(error){await this.store.transaction(s=>{if(s.revision===base.revision){s.status='withheld';s.issues=[String((error as Error).message)];s.cacheExpiresAt=0;}});this.cache=null;return {status:'withheld',updated:false};}
   if(this.elapsedNow()-started>pipelineLimits.deadlineMs)throw new OperatingLimit('Private update deadline exceeded');
   candidateSignature=confirmedResumeSignature(capture.inputs);const input=confirmedInput(capture.inputs);input.editions=input.editions.map(e=>base.prior?.editions.find(old=>old.id===e.id&&old.date===e.date)??e);const identity=semantic(input);
   return await this.store.transaction(s=>{
    if(s.revision!==base.revision)return {status:'superseded',updated:false};
    const head=s.history.at(-1);s.checkedAt=capture.inputs.observedAt;
    if(head?.semantic===identity){s.sourceSignature=confirmedResumeSignature(capture.inputs);s.status='ready';s.issues=[];if(this.cache&&this.cache.revision===s.revision&&(this.cache.value as {status:string}).status==='ready'){(this.cache.value as {checkedAt:string}).checkedAt=capture.inputs.observedAt;this.cache.until=Math.min(now+pipelineLimits.cacheMs,Date.parse(capture.inputs.observedAt)+pipelineLimits.sourceAgeMs);}else this.cache=null;return {status:'unchanged',updated:false,revision:s.revision};}
    charge(s,now,'update');
    const current=runShadow(input,candidates[0],false,null,'resume-shadow-v1.2.0'),provisional=runShadow(input,candidates[0],true,current.id,current.modelVersion);
    const pair=packSnapshotPair(current,provisional),entry:Entry={id:'',semantic:identity,at:current.at,encoded:pair.encoded,sourceHashes:capture.sourceHashes,notes:capture.notes??[]};entry.id=hash({encoded:entry.encoded,sourceHashes:entry.sourceHashes,notes:entry.notes});
    if(head&&Date.parse(entry.at)<=Date.parse(head.at))throw Error('Changed input requires a later observation epoch');
    s.history.push(entry);while(s.history.length>pipelineLimits.history||s.history.reduce((n,e)=>n+Buffer.byteLength(e.encoded)+512,0)>pipelineLimits.historyBytes)s.history.shift();
    if(s.history.length<2&&head)throw new OperatingLimit('New entry would lose its comparison context');
    s.revision++;s.sourceSignature=confirmedResumeSignature(capture.inputs);s.season=input.season;s.status='ready';s.issues=[];s.view=render(s,now);s.cacheExpiresAt=now+pipelineLimits.cacheMs;
    if(this.elapsedNow()-started>pipelineLimits.deadlineMs)throw new OperatingLimit('Model update deadline exceeded');
    if(s.view?.issues.length)throw Error('Model evidence not displayable: '+s.view.issues.join('; '));
    if(Buffer.byteLength(JSON.stringify(s))>pipelineLimits.stateBytes)throw new OperatingLimit('Private state size limit exceeded');
    this.cache=null;return {status:'updated',updated:true,revision:s.revision,receipt:entry.id,retained:s.history.length};
   });
  }catch(error){this.cache=null;try{await this.store.transaction(s=>{if(expectedRevision!==null&&s.revision!==expectedRevision&&s.sourceSignature!==candidateSignature)return;s.status='withheld';s.issues=[(error as Error).message];s.cacheExpiresAt=0;});}catch{/* Corrupt/busy storage remains unavailable; do not invent a head. */}return {status:error instanceof OperatingLimit?'budget-withheld':'failed',updated:false,reason:(error as Error).message};}finally{this.busy=false;}
 }
 async historyView(id:string,now=Date.now()){
  if(!/^[a-f0-9]{64}$/.test(id))return {status:'unavailable',view:null,publicActivation:false};
  try{return await this.store.transaction(s=>{charge(s,now,'cache');const index=s.history.findIndex(e=>e.id===id);if(index<0)return {status:'unavailable',view:null,publicActivation:false};const current=restore(s.history[index]),previous=index>0?restore(s.history[index-1]):undefined;if(now<Date.parse(current.at))return {status:'unavailable',view:null,publicActivation:false};return {status:'archived',view:fanResume(current,previous,new Date(now).toISOString()),comparisonContextRetained:!!previous,publicActivation:false};});}catch{return {status:'unavailable',view:null,publicActivation:false};}
 }
 async display(now=Date.now()){
  const minute=Math.floor(now/60000);if(minute!==this.traffic.minute)this.traffic={minute,requests:0,bytes:0};
  if(++this.traffic.requests>pipelineLimits.displayRequestsPerMinute)return {private:true,publicActivation:false,status:'rate-limited',view:null};
  const admit=(value:unknown)=>{const bytes=Buffer.byteLength(JSON.stringify(value));if(this.traffic.bytes+bytes>pipelineLimits.displayBytesPerMinute)return {private:true,publicActivation:false,status:'rate-limited',view:null};this.traffic.bytes+=bytes;return structuredClone(value);};
  if(!this.store.readDisplay&&this.cache&&now>=this.cache.from&&this.cache.until>now)return admit(this.cache.value);
  try{if(this.store.readDisplay){const packet=await this.store.readDisplay();if(packet?.view){const check=packet.checkedAt?Date.parse(packet.checkedAt):0;if(now<Date.parse(packet.view.at))throw Error('Display clock predates shared capture');const supported=packet.status==='ready'&&check<=now&&now-check<=pipelineLimits.sourceAgeMs;const view=structuredClone(packet.view);if(!supported){view.comparison='withheld';view.freshness='last confirmed capture — refresh withheld';view.issues=[...view.issues,...packet.issues,'Shared source check unavailable or stale'];view.liveScenario=null;for(const r of view.rows){r.movement=null;r.resumePosition=null;r.score=null;r.scoreDelta=null;r.reasons=[];r.drivers=[];r.recordLabel='Last confirmed record; refresh withheld';}}const value={...packet,view,status:supported?'ready':'withheld',private:true,publicActivation:false,transport:'injected Redis protocol',actualRedisCommands:null,additionalSchedules:0};this.cache={revision:packet.revision,from:now,until:Math.min(now+pipelineLimits.cacheMs,check+pipelineLimits.sourceAgeMs),value};return admit(value);}}
   return await this.store.transaction(s=>{
   if(s.history.at(-1)&&now<Date.parse(s.history.at(-1)!.at))throw Error('Display clock predates stored capture');
   charge(s,now,'cache');const lastCheck=s.checkedAt?Date.parse(s.checkedAt):0;
   const stale=now-lastCheck>pipelineLimits.sourceAgeMs||lastCheck>now;
   if(s.cacheExpiresAt<=now)s.view=render(s,now);
   const supported=s.status==='ready'&&!stale;const view=s.view?structuredClone(s.view):null;
   if(view&&!supported){view.comparison='withheld';view.issues=[...view.issues,...s.issues,stale?'Current source check stale; movement withheld':'Refresh unavailable; last confirmed evidence only'];for(const r of view.rows){r.movement=null;r.scoreDelta=null;r.reasons=[];r.drivers=[];}view.liveScenario=null;view.freshness='last confirmed capture — refresh withheld';for(const r of view.rows){r.resumePosition=null;r.score=null;r.recordLabel='Last confirmed record; refresh withheld';}}
   s.cacheExpiresAt=now+pipelineLimits.cacheMs;
   const value={private:true,publicActivation:false,revision:s.revision,status:supported?'ready':'withheld',checkedAt:s.checkedAt,issues:s.issues,view,history:s.history.map(e=>({id:e.id,at:e.at})),reservedCosts:{daily:s.daily,monthly:s.monthly},actualRedisCommands:0,additionalSchedules:0};
   this.cache={revision:s.revision,from:now,until:Math.min(now+pipelineLimits.cacheMs,lastCheck+pipelineLimits.sourceAgeMs),value:structuredClone(value)};return admit(value);
  });}catch(error){return {private:true,publicActivation:false,status:'unavailable',reason:(error as Error).message,view:null};}
 }
}
