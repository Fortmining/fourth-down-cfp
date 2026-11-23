import {mergeArchive,emptyArchive,type StoryStore} from './pulse-story-store.ts';
import {warnPulseArchive} from './pulse-story-runtime.ts';
import type {NewsItem,NewsPacket} from './news-pulse.ts';
/** One ingestion, one CAS attempt; at most one readback on contention. No commit retries. */
export async function fillPulseArchive(store:StoryStore,now:number,previous:NewsItem[]|undefined,ingest:(now:number,previous:NewsItem[])=>Promise<NewsPacket>):Promise<NewsPacket>{
 let old: Awaited<ReturnType<StoryStore['read']>>;
 try {
   old = await store.read();
 } catch (error) {
   warnPulseArchive('read', error);
   const packet = await ingest(now, previous || []);
   return {...packet, freshness: [{status:'unavailable', observedAt:new Date(now).toISOString(),
     message:'The shared story archive is unavailable.'}, ...(packet.freshness || [])]};
 }
 const packet=await ingest(now,old.state?.items||previous||[]),next=mergeArchive(old.state||emptyArchive(),packet.items,now);
 if(next===old.state)return {...packet,items:next.items};
 let status: Awaited<ReturnType<StoryStore['commit']>>;
 try { status=await store.commit(old.etag,next); } catch (error) { warnPulseArchive('commit', error); status='limited'; }
 if(status==='limited')return {...packet,freshness:[...(packet.freshness||[]),{status:'unavailable',observedAt:new Date(now).toISOString(),message:'Showing verified stories. Archive storage is temporarily limited.'}]};
 if(status==='saved')return {...packet,items:next.items};
 if(status==='conflict'){
  const current=await store.read();
  if(current.state&&Date.parse(current.state.checkedAt)>=Date.parse(old.state?.checkedAt||new Date(0).toISOString()))return {...packet,items:current.state.items,freshness:[{status:'cached',observedAt:new Date(now).toISOString(),message:'Another request updated the shared feed. Showing its confirmed archive; this request did not repeat the write.'}]};
 }
 throw Error('Pulse archive conflict readback unavailable');
}
