import {unstable_cache,revalidateTag} from 'next/cache';
import {cachedResumeStore} from './cached-resume-store';
import type {ResumeStore} from './resume-pipeline';
/** Prepared server adapter only. Not called by production or the private file API.
 * The existing Redis quota remains authoritative on cache misses. No credentials,
 * polling, deployment or public activation are configured here. */
export function nextCachedResumeStore(store:ResumeStore,namespace:string,revalidateSeconds=60):ResumeStore{
 if(!/^fd:\{resume-private-[a-f0-9]{16,64}\}:$/.test(namespace)||!store.readDisplay)throw Error('Explicit resume namespace and materialized display required');
 if(![60,300].includes(revalidateSeconds))throw Error('Unsupported display cache interval');
 const tag='resume-display:'+namespace;
 const read=unstable_cache(async()=>{try{return {packet:await store.readDisplay!(),unavailable:false};}catch{return {packet:null,unavailable:true};}},['resume-display-v1',namespace],{revalidate:revalidateSeconds,tags:[tag]});
 // Cache a negative receipt too: a quota/error must not trigger a Redis request
 // for every visitor. Never fall through to a full state read on this path.
 return cachedResumeStore(store,{read:async()=>{const result=await read();if(result.unavailable||!result.packet)throw Error('Shared resume display unavailable');return result.packet;},invalidate:()=>revalidateTag(tag)});
}
