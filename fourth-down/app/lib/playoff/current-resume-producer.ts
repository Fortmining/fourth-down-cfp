import type {Inputs} from './types';
import {hash} from './engine.ts';
import {captureResumeUpdate} from './resume-source.ts';
import {ResumePipeline} from './resume-pipeline.ts';
export type CapturedResumeBatch={scoreboard:unknown;rankings?:unknown;standings?:unknown;observedAt:string;trace:{policy:string;ok:boolean;receivedAt:string;ageSeconds?:number|null}};
/** Development integration: accepts already-fetched verified sources. No timer,
 * network transport, notification dependency or production scheduling hook. */
export class CurrentResumeProducer{
 private seed:Inputs|null=null;private busy=false;private reload=true;
 readonly pipeline:ResumePipeline;readonly bootstrap:Inputs;
 constructor(pipeline:ResumePipeline,bootstrap:Inputs){this.pipeline=pipeline;this.bootstrap=bootstrap;if(bootstrap.season!==2026)throw Error('Current-season producer requires the verified 2026 ledger');}
 async accept(batch:CapturedResumeBatch,now=Date.now()){
  if(this.busy)return {status:'busy',updated:false};this.busy=true;
  try{
   if(this.reload){this.seed=await this.pipeline.confirmedInputs()??structuredClone(this.bootstrap);this.reload=false;}
   const at=Date.parse(batch.observedAt),received=Date.parse(batch.trace.receivedAt);
   if(!batch.trace.ok||batch.trace.policy!=='no-store'||!Number.isFinite(at)||!Number.isFinite(received)||at<received||at>now||now-received>360000||(batch.trace.ageSeconds??0)>30)throw Error('Current source freshness unavailable');
   if(at<Date.parse(this.seed!.observedAt))return {status:'superseded',updated:false};
   const capture=captureResumeUpdate(this.seed!,batch.scoreboard,batch.observedAt,{rankings:batch.rankings,standings:batch.standings});
   capture.sourceHashes.verification=hash(batch.trace);
   const result=await this.pipeline.ingest(capture,now);
   if(result.updated||result.status==='unchanged')this.seed=capture.inputs;
   else this.reload=true; // Lost ack may have committed: reload that head before composing another feed.
   return result;
  }catch(error){this.reload=true;return {status:'source-withheld',updated:false,reason:(error as Error).message};}
  finally{this.busy=false;}
 }
}
