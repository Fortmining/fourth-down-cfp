import type {Inputs} from './types';
import {CurrentResumeProducer,type CapturedResumeBatch} from './current-resume-producer.ts';
import {ResumePipeline,type ResumeStore,type SharedResumeDisplay} from './resume-pipeline.ts';
/** One application service for producer and fan display. Inject an authorized store;
 * this module provisions nothing and reads no credentials or production settings. */
export class ResumeCenterService{
 readonly pipeline:ResumePipeline;readonly producer:CurrentResumeProducer|null;
 constructor(store:ResumeStore,seed?:Inputs,elapsedNow=()=>performance.now()){
  this.pipeline=new ResumePipeline(store,{read:async()=>{throw Error('Only an existing verified source capture may update resumes');}},elapsedNow);
  this.producer=seed?new CurrentResumeProducer(this.pipeline,seed):null;
 }
 acceptConfirmedSource(batch:CapturedResumeBatch,now=Date.now()){if(!this.producer)throw Error('Display-only service cannot ingest sources');return this.producer.accept(batch,now);}
 async display(snapshotId:string|null=null,now=Date.now()){
  const current=await this.pipeline.display(now) as Partial<SharedResumeDisplay>;
  if(!snapshotId)return current;
  const saved=await this.pipeline.historyView(snapshotId,now);
  if(saved.status!=='archived'||saved.view?.season!==2026)return {status:'unavailable',view:null,publicActivation:false};
  return {...current,status:'archived',view:saved.view,checkedAt:saved.view.at};
 }
}
