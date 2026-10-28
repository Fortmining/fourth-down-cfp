import type {ResumeStore,SharedResumeDisplay} from './resume-pipeline.ts';
/** Shared cache stores only the signed display packet, never a computed freshness
 * verdict. ResumePipeline checks source age on EVERY consumer request. */
export type ResumeDisplayCache={read:(load:()=>Promise<SharedResumeDisplay|null>)=>Promise<SharedResumeDisplay|null>;invalidate:()=>void|Promise<void>};
export function cachedResumeStore(store:ResumeStore,cache:ResumeDisplayCache):ResumeStore{
 if(!store.readDisplay)throw Error('Materialized shared display required');
 return {
  readDisplay:()=>cache.read(()=>store.readDisplay!()),
  transaction:async operation=>{const result=await store.transaction(operation);await cache.invalidate();return result;},
  ...(store.renewVerifiedFreshness?{renewVerifiedFreshness:async(signature:string,at:string)=>{const renewed=await store.renewVerifiedFreshness!(signature,at);if(renewed)await cache.invalidate();return renewed;}}:{}),
 };
}
