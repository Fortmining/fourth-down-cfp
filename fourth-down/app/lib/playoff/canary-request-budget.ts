import fs from 'node:fs';import path from 'node:path';import {canaryLimits} from './resume-canary.ts';
type Kind='api'|'pages'|'assets'|'cleanup';
const bytes={api:768*1024,pages:512*1024,assets:256*1024,cleanup:16384};
/** Local supervisor only. Durable reservations BEFORE HTTP. No refunds, retries,
 * remote endpoint, credential reads or independent browser budget owners. */
export class CanaryRequestBudget{
 readonly file:string;readonly lock:string;readonly run:string;
 constructor(root:string,run:string,create=false){
 this.run=run;
 if(!/^[a-f0-9]{24}$/.test(run))throw Error('Fixed canary run required');fs.mkdirSync(root,{recursive:true,mode:0o700});this.file=path.join(fs.realpathSync(root),run+'.canary.jsonl');this.lock=this.file+'.lock';
 if(create){const fd=fs.openSync(this.file,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify({schema:1,run,start:Date.now()})+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
 this.snapshot();
 }
 snapshot(){const text=fs.readFileSync(this.file,'utf8');if(text.length>65536||!text.endsWith('\n'))throw Error('Corrupt canary ledger');const lines=text.trimEnd().split('\n').map(l=>JSON.parse(l)),head=lines.shift();if(head.schema!==1||head.run!==this.run||!Number.isSafeInteger(head.start))throw Error('Canary manifest mismatch');const counts={api:0,pages:0,assets:0,cleanup:0},ids=new Set<string>();let reservedBytes=0;
 for(const row of lines){if(ids.has(row.id)||!Object.hasOwn(counts,row.kind)||row.bytes!==bytes[row.kind as Kind])throw Error('Corrupt canary reservation');ids.add(row.id);counts[row.kind as Kind]++;reservedBytes+=row.bytes;}
 const total=ids.size;if(total>canaryLimits.total||reservedBytes>canaryLimits.bodyBytes||Object.entries(counts).some(([k,n])=>n>canaryLimits[k as Kind]))throw Error('Canary cap exceeded');return {start:head.start,counts,total,reservedBytes,ids};
 }
 reserve(id:string,kind:Kind,now=Date.now()){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!Object.hasOwn(bytes,kind))throw Error('Invalid canary reservation');const fd=fs.openSync(this.lock,'wx',0o600);
 try{const s=this.snapshot();if(s.ids.has(id))throw Error('Canary ticket consumed');if(kind!=='cleanup'&&(now<s.start||now-s.start>canaryLimits.workMs))throw Error('Canary work deadline');if(s.counts[kind]>=canaryLimits[kind]||s.total>=canaryLimits.total||s.reservedBytes+bytes[kind]>canaryLimits.bodyBytes)throw Error('Canary allowance exhausted');const out=fs.openSync(this.file,'a',0o600);try{fs.writeFileSync(out,JSON.stringify({id,kind,bytes:bytes[kind]})+'\n');fs.fsyncSync(out);}finally{fs.closeSync(out);}return bytes[kind];}finally{fs.closeSync(fd);fs.unlinkSync(this.lock);}
 }
}
export function canaryHttpSupervisor(budget:CanaryRequestBudget,origin:string,headers:Record<string,string>={},fetcher:typeof fetch=fetch){
 const approved=new URL(origin);if(approved.origin!==origin||approved.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(approved.hostname))throw Error('Exact approved canary origin required');const owner=Math.random().toString(16).slice(2,10);let active=0,sequence=0;const pending:(()=>void)[]=[];const acquire=async()=>{if(active<canaryLimits.concurrency){active++;return;}if(pending.length>=canaryLimits.total)throw Error('Canary queue full');await new Promise<void>(resolve=>pending.push(resolve));};const release=()=>{if(pending.length)pending.shift()!();else active--;};const receipts:{path:string;status:number;bytes:number;ms:number;requestId:string|null}[]=[];
 const get=async(url:string,kind:Kind)=>{
 const target=new URL(url,approved);if(target.origin!==approved.origin||target.username||target.password)throw Error('Canary origin/concurrency rejected');
 await acquire();const started=performance.now(),abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{const cap=budget.reserve('http_'+owner+'_'+process.pid+'_'+Date.now()+'_'+sequence++,kind);timer=setTimeout(()=>abort.abort(),20000);const response=await fetcher(target,{method:'GET',headers,redirect:'manual',signal:abort.signal});const reader=response.body?.getReader();if(!reader)throw Error('Canary body unavailable');const chunks:Uint8Array[]=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>cap){abort.abort();throw Error('Canary response cap');}chunks.push(r.value);}const body=Buffer.concat(chunks);receipts.push({path:target.pathname+target.search,status:response.status,bytes:size,ms:performance.now()-started,requestId:response.headers.get('x-vercel-id')});return {status:response.status,body,headers:{'content-type':response.headers.get('content-type')??'application/octet-stream'}};
 }finally{clearTimeout(timer);release();}
 };
 return {get,receipts};
}
export function validCanaryAdmission(value:unknown,origin:string,run:string,now=Date.now()){
 if(!value||typeof value!=='object')return false;const a=value as Record<string,unknown>,end=typeof a.expiresAt==='string'?Date.parse(a.expiresAt):NaN;
 return a.origin===origin&&a.run===run&&a.target==='preview'&&a.projectId==='prj_uvQVwE3b4FHEiGFkzK3eAGYsv4ct'&&typeof a.deploymentId==='string'&&/^dpl_[A-Za-z0-9]{8,}$/.test(a.deploymentId)&&Number.isFinite(end)&&end>now&&end-now<=1800000&&/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)&&origin!=='https://fourth-down-cfp.vercel.app';
}
