import {unstable_cache,revalidateTag} from 'next/cache';
import {cachedResumeStore} from './cached-resume-store';
import type {ResumeStore} from './resume-pipeline';
/** Prepared server adapter only. Not called by production or the private file API.
 * The existing Redis quota remains authoritative on cache misses. No credentials,
 * polling, deployment or public activation are configured here. */
export function nextCachedResumeStore(store:ResumeStore,namespace:string):ResumeStore{
 if(!/^fd:\{resume-private-[a-f0-9]{16,64}\}:$/.test(namespace)||!store.readDisplay)throw Error('Explicit resume namespace and materialized display required');
 const tag='resume-display:'+namespace;
 const read=unstable_cache(async()=>{try{return {packet:await store.readDisplay!(),unavailable:false};}catch{return {packet:null,unavailable:true};}},['resume-display-v1',namespace],{revalidate:60,tags:[tag]});
 // Cache a negative receipt too: a quota/error must not trigger a Redis request
 // for every visitor. Never fall through to a full state read on this path.
 return cachedResumeStore(store,{read:async()=>{const result=await read();if(result.unavailable||!result.packet)throw Error('Shared resume display unavailable');return result.packet;},invalidate:()=>revalidateTag(tag)});
}
