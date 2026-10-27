// Loopback-only controlled replay. Never imports push, Redis or notification routes.
import {gzipSync} from 'node:zlib';import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {ResumePipeline} from '../app/lib/playoff/resume-pipeline.ts';import {FileResumeStore} from '../app/lib/playoff/file-resume-store.ts';
const source=process.env.RESUME_REPLAY_SOURCE,root=process.env.RESUME_REPLAY_STORE,html=process.env.RESUME_PREVIEW_HTML;
if(!source||!root||!html)throw Error('Explicit replay source, isolated store and preview HTML required');
const port=Number(process.env.PORT||3018);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid loopback port');
const template=fs.readFileSync(html,'utf8'),match=template.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/);if(!match)throw Error('Existing preview template required');
const original=JSON.parse(match[1]),key=process.env.RESUME_REPLAY_VIEW==='current'?'current':'replay';
let replayClock=Date.now(),lastError='',lastRevision=0,loading=false,dirty=false;
const load=()=>{if(fs.statSync(source).size>2*1024*1024)throw Error('Replay input exceeds cap');return JSON.parse(fs.readFileSync(source,'utf8'));};
const pipeline=new ResumePipeline(new FileResumeStore(root),{read:async signal=>{if(signal.aborted)throw Error('Replay aborted');return load();}});
async function ingest(){dirty=true;if(loading)return;loading=true;try{while(dirty){dirty=false;try{const c=load();const nextClock=Date.parse(c.receivedAt);if(!Number.isFinite(nextClock))throw Error('Invalid replay clock');replayClock=nextClock;const result=await pipeline.tick(replayClock);if('revision' in result)lastRevision=result.revision;lastError=result.updated||result.status==='unchanged'?'':result.status;}catch{lastError='Invalid replay source; refresh withheld';await pipeline.tick(replayClock);}}}finally{loading=false;}}
await ingest();
const watcher=fs.watch(path.dirname(source),(_,file)=>{if(String(file)===path.basename(source))void ingest();});
const server=http.createServer(async(req,res)=>{
 try{if(req.method!=='GET'||req.headers.host!=='127.0.0.1:'+port){res.writeHead(405);res.end();return;}
 const parsed=new URL(req.url,'http://127.0.0.1:'+port),route=parsed.pathname;if(route==='/status.json'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:lastError||'ready',revision:lastRevision,loading}));return;}if(route==='/history.json'){const d=await pipeline.historyView(parsed.searchParams.get('id')||'',replayClock);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex'});res.end(JSON.stringify(d));return;}if(!['/','/view.json'].includes(route)){res.writeHead(404);res.end();return;}
 const display=await pipeline.display(replayClock),views=structuredClone(original.views);if(display.view)views[key]=display.view;
 const pipelineStatus={status:lastError||display.status,revision:display.revision??null,history:display.history??[],mode:'Private controlled as-of replay; not live production data'};
 if(!display.view){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(pipelineStatus));return;}
 const headers={'Content-Type':route==='/'?'text/html; charset=utf-8':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
 const send=body=>{const zipped=/\bgzip\b/.test(req.headers['accept-encoding']||'');const data=zipped?gzipSync(body):Buffer.from(body);res.writeHead(200,{...headers,'Content-Length':data.length,'Vary':'Accept-Encoding',...(zipped?{'Content-Encoding':'gzip'}:{})});res.end(data);};
 if(route==='/view.json'){send(JSON.stringify({...views,pipeline:pipelineStatus}));return;}
 const payload=JSON.stringify({...original,views}).replace(/</g,'\\u003c');const status='PRIVATE CONTROLLED REPLAY · '+pipelineStatus.status+' · update '+pipelineStatus.revision+' · not a live feed';
 send(template.replace(match[0],'<script id="payload" type="application/json">'+payload+'</script>').replace('<main id="top">','<main id="top"><p class="meta" id="pipeline-status" role="status">'+status+'</p>'));
 }catch{res.writeHead(503);res.end('Private replay unavailable; no fabricated display');}
});
server.listen(port,'127.0.0.1',()=>console.log('Private integrated Resume replay: http://127.0.0.1:'+port));
process.on('SIGTERM',()=>{watcher.close();server.close();});
