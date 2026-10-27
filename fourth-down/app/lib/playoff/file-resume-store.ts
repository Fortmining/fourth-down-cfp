import fs from 'node:fs';import path from 'node:path';
import {hash} from './engine.ts';
import {emptyPipelineState,pipelineLimits,type PipelineState,type ResumeStore} from './resume-pipeline.ts';
/** Offline/private adapter: no Redis credentials, HTTP calls or production route. */
export class FileResumeStore implements ResumeStore{
 readonly file:string;readonly lock:string;
 readonly directory:string;readonly fault?: (phase:'before-rename'|'after-rename')=>void;
 constructor(directory:string,fault?:(phase:'before-rename'|'after-rename')=>void){
  this.directory=directory;this.fault=fault;
  const root=path.resolve(directory);if(root===path.parse(root).root)throw Error('Explicit isolated private directory required');
  fs.mkdirSync(root,{recursive:true,mode:0o700});this.file=path.join(root,'resume-pipeline-state.json');this.lock=path.join(root,'resume-pipeline.lock');
 }
 private recoverLock(){
  if(!fs.existsSync(this.lock))return;
  const pid=JSON.parse(fs.readFileSync(this.lock,'utf8')).pid;if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid private lock; manual inspection required');
  try{process.kill(pid,0);}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH'){fs.unlinkSync(this.lock);return;}throw error;}
  throw Error('Private resume writer busy');
 }
 async transaction<T>(operation:(state:PipelineState)=>T):Promise<T>{
  this.recoverLock();const fd=fs.openSync(this.lock,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));const temp=this.file+'.'+process.pid+'.tmp';
  try{
   let original=emptyPipelineState();if(fs.existsSync(this.file)){
    if(fs.statSync(this.file).size>pipelineLimits.stateBytes+1024)throw Error('Private state exceeds byte limit');
    const disk=JSON.parse(fs.readFileSync(this.file,'utf8'));if(disk.checksum!==hash(disk.state)||disk.state.schema!==1)throw Error('Private state integrity check failed');original=disk.state;
   }
   const state=structuredClone(original),result=operation(state);
   if(result&&typeof (result as {then?:unknown}).then==='function')throw Error('Async transaction callbacks are forbidden');
   if(hash(original)!==hash(state)){
    const data=JSON.stringify({checksum:hash(state),state});if(Buffer.byteLength(data)>pipelineLimits.stateBytes+1024)throw Error('Private state byte limit exceeded');
    const output=fs.openSync(temp,'wx',0o600);try{fs.writeFileSync(output,data);fs.fsyncSync(output);}finally{fs.closeSync(output);}
    this.fault?.('before-rename');fs.renameSync(temp,this.file);const dir=fs.openSync(this.directory,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}this.fault?.('after-rename');
   }
   return structuredClone(result);
  }finally{fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);fs.unlinkSync(this.lock);}
 }
}
