import {mergeArchive,emptyArchive,type StoryStore} from './pulse-story-store.ts';
import type {NewsItem,NewsPacket} from './news-pulse.ts';
/** One ingestion, one CAS attempt; at most one readback on contention. No commit retries. */
export async function fillPulseArchive(store:StoryStore,now:number,previous:NewsItem[]|undefined,ingest:(now:number,previous:NewsItem[])=>Promise<NewsPacket>):Promise<NewsPacket>{
 const old=await store.read(),packet=await ingest(now,old.state?.items||previous||[]),next=mergeArchive(old.state||emptyArchive(),packet.items,now);
 if(next===old.state)return {...packet,items:next.items};
 const status=await store.commit(old.etag,next);
 if(status==='saved')return {...packet,items:next.items};
 if(status==='conflict'){
  const current=await store.read();
  if(current.state&&Date.parse(current.state.checkedAt)>=Date.parse(old.state?.checkedAt||new Date(0).toISOString()))return {...packet,items:current.state.items,freshness:[{status:'cached',observedAt:new Date(now).toISOString(),message:'Another request updated the shared feed. Showing its confirmed archive; this request did not repeat the write.'}]};
 }
 throw Error(status==='limited'?'Pulse archive budget limited':'Pulse archive conflict readback unavailable');
}
