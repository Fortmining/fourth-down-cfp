import {decodeTeamView} from './cfbd-team-view.ts';
import {isPulseTeam} from './pulse-teams.ts';

const ORIGIN='https://cfbd.fortmedia.cc';
const LIMIT=24*1024;
const FRESH=6*60*60*1000;
const STALE=24*60*60*1000;
type View=NonNullable<ReturnType<typeof decodeTeamView>>;
type Entry={view:View;etag?:string;checked:number;retry:number};
export type ReaderResult={view:View|null;stale:boolean};
type Config={enabled:boolean;clientId:string;clientSecret:string;bearer:string};
export function readerConfig(env:NodeJS.ProcessEnv=process.env):Config {
  return {enabled:env.PULSE_CFBD_READ==='cloudflare-v1',
    clientId:env.PULSE_CFBD_ACCESS_CLIENT_ID||'',clientSecret:env.PULSE_CFBD_ACCESS_CLIENT_SECRET||'',
    bearer:env.PULSE_CFBD_ORIGIN_BEARER||''};
}

// This bounded cache is an optimization for a warm function instance, not durable
// storage. Cold instances fetch again; no Redis commands or provider calls occur.
export function createTeamReader({request=fetch,now=Date.now,config=readerConfig}: {
  request?:typeof fetch;now?:()=>number;config?:()=>Config;
}={}) {
  const entries=new Map<string,Entry>();
  const inflight=new Map<string,Promise<ReaderResult>>();
  let credentials='';
  return async function read(team:string):Promise<ReaderResult> {
    if(!isPulseTeam(team))return {view:null,stale:false};
    const cfg=config();
    const identity=JSON.stringify(cfg);
    if(identity!==credentials){entries.clear();inflight.clear();credentials=identity;}
    if(!cfg.enabled||![cfg.clientId,cfg.clientSecret,cfg.bearer].every(v=>v.length>0&&v.length<=1024&&/^[\x21-\x7e]+$/.test(v)))
      return {view:null,stale:false};
    const previous=entries.get(team),time=now();
    if(previous&&time-previous.checked<FRESH)return {view:previous.view,stale:false};
    if(previous&&time<previous.retry)return {view:time-previous.checked<=STALE?previous.view:null,stale:true};
    const pending=inflight.get(team);if(pending)return pending;
    const job=(async():Promise<ReaderResult>=>{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),4000);
      try {
        const headers:Record<string,string>={'CF-Access-Client-Id':cfg.clientId,
          'CF-Access-Client-Secret':cfg.clientSecret,Authorization:'Bearer '+cfg.bearer,Accept:'application/json','User-Agent':'FourthDownPulseReader/1.0'};
        if(previous?.etag)headers['If-None-Match']=previous.etag;
        const res=await request(ORIGIN+'/v1/teams/'+team,{headers,redirect:'error',cache:'no-store',signal:controller.signal});
        // Authorization revocation and missing views must not be masked by a cache.
        if([401,403,404].includes(res.status)){await res.body?.cancel();entries.delete(team);return {view:null,stale:false};}
        let entry:Entry;
        if(res.status===304){
          if(!previous)throw Error('Unexpected conditional response');
          entry={...previous,checked:now(),retry:0};
        }else{
          if(res.status!==200||!/^application\/json(?:\s*;|$)/i.test(res.headers.get('content-type')||'')){
            await res.body?.cancel();throw Error('Unavailable');
          }
          const length=res.headers.get('content-length');
          if(length&&(!/^\d+$/.test(length)||Number(length)>LIMIT)){await res.body?.cancel();throw Error('Size');}
          if(!res.body)throw Error('Empty');
          const stream=res.body.getReader(),chunks:Uint8Array[]=[];let size=0;
          try {for(;;){const part=await stream.read();if(part.done)break;size+=part.value.byteLength;
            if(size>LIMIT)throw Error('Size');chunks.push(part.value);}}
          finally {await stream.cancel();stream.releaseLock();}
          const view=decodeTeamView(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)),team);
          if(!view)throw Error('Schema');
          const tag=res.headers.get('etag');
          entry={view,checked:now(),retry:0,etag:tag&&/^(?:W\/)?"[\x21\x23-\x7e]{1,128}"$/.test(tag)?tag:undefined};
        }
        if(credentials===identity)entries.set(team,entry);
        return {view:entry.view,stale:false};
      }catch{
        if(previous&&credentials===identity){previous.retry=now()+60_000;
          return {view:now()-previous.checked<=STALE?previous.view:null,stale:true};}
        return {view:null,stale:false};
      }finally{clearTimeout(timeout);}
    })();
    inflight.set(team,job);
    try{return await job;}finally{if(inflight.get(team)===job)inflight.delete(team);}
  };
}
export const readHttpTeam=createTeamReader();
