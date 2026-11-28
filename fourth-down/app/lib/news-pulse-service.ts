import {privateRssReviewEnabled,publicSportsRssEnabled} from './pulse-rss-policy';
import {pulseReleaseEnabled} from './pulse-release';
import {configuredPulseStore,warnPulseArchive} from './pulse-story-runtime';
import {fillPulseArchive} from './pulse-archive-fill';
import {youtubeAdapters} from './pulse-youtube-adapters';
import {unstable_cache} from 'next/cache';
import {newsLiveEnabled,ingestNews,NEWS_LIMITS,permittedAdapters,safeSourceFailure,type SourceRead} from './news-pulse-ingestion';
import {pulseSource} from './pulse-source-registry';
import {newsFixturesEnabled} from './news-review-mode';
import {newsSources,type NewsPacket} from './news-pulse';
let previous:NewsPacket|undefined,inFlight:Promise<NewsPacket>|undefined,nextAttempt=0;
const adapters=[...permittedAdapters(),...youtubeAdapters()].map(a=>{const source=pulseSource(a.id)!;const cached=unstable_cache(async()=>{const now=Date.now();try{const data=await a.read(now);return Array.isArray(data)?{items:data,observedAt:new Date(now).toISOString()}:data;}catch(error){return {items:[],observedAt:new Date(now).toISOString(),error:safeSourceFailure(error)};}},['pulse-provider-v3',publicSportsRssEnabled()?'sports-v1':'baseline',a.id,source.endpoint||'editorial'],{revalidate:(source.minimumPollMinutes||60)*60});return {...a,read:async()=>cached() as Promise<SourceRead>};});
async function fill(){const now=Date.now();if(previous&&now<nextAttempt)return previous;if(inFlight)return inFlight;nextAttempt=now+NEWS_LIMITS.refreshSeconds*1000;inFlight=fillWithArchive(now).then(p=>(previous=p)).finally(()=>{inFlight=undefined;});return inFlight;}
async function fillWithArchive(now: number): Promise<NewsPacket> {
  const store = configuredPulseStore();
  if (!store) {
    const packet = await ingestNews(now, previous?.items, adapters);
    if (!pulseReleaseEnabled()) return packet;
    return {...packet, freshness: [{status:'unavailable', observedAt:new Date(now).toISOString(),
      message:'The shared story archive is unavailable.'}, ...(packet.freshness || [])]};
  }
  let sourcePacket: Promise<NewsPacket> | undefined;
  const readSources = (at: number, items?: NewsPacket['items']) =>
    sourcePacket ??= ingestNews(at, items, adapters);
  try {
    return await fillPulseArchive(store, now, previous?.items, readSources);
  } catch (error) {
    warnPulseArchive('update', error);
    const packet = await readSources(now, previous?.items);
    return {...packet, freshness: [{status:'unavailable', observedAt:new Date(now).toISOString(),
      message:'The shared story archive is unavailable.'}, ...(packet.freshness || [])]};
  }
}
const shared=unstable_cache(fill,['pulse-national-rss-v7',publicSportsRssEnabled()?'sports-v1':'baseline',privateRssReviewEnabled()?'private-rss-v1':process.env.VERCEL_ENV||'local',pulseReleaseEnabled()?'public-v1':'review-v1'],{revalidate:NEWS_LIMITS.refreshSeconds});
export async function newsPacket():Promise<NewsPacket>{if(newsLiveEnabled())return shared();if(newsFixturesEnabled())return (await import('./news-pulse-fixtures')).newsFixturePacket();return {version:1,mode:'unavailable',evaluatedAt:new Date().toISOString(),items:[],sources:newsSources,pushDelivery:false};}
export async function newsStory(source:string,id:string){if(!/^[a-z0-9-]{1,60}$/.test(source)||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return null;const packet=await newsPacket();const current=packet.items.find(i=>i.sourceId===source&&i.id===id);if(current)return current.state!=='retracted'&&current.state!=='conflicted'?{packet,item:current}:null;return null;}
export function newsStoryOrigin(){const host=process.env.VERCEL_URL;if(process.env.VERCEL_ENV==='preview'&&host&&/^[a-z0-9-]+\.vercel\.app$/.test(host))return new URL('https://'+host);return new URL('https://fourth-down-cfp.vercel.app');}
