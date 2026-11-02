import {pulseSources} from './pulse-source-registry.ts';
import {pulseTeamNames,pulseTeams} from './pulse-teams.ts';
// News discovery is independent of score-based GameDay Pulse and never sends push.
export const NEWS_PILOT_UI = process.env.NEXT_PUBLIC_FOURTH_DOWN_NEWS_PILOT === 'true';
export type NewsKind = 'news' | 'highlight' | 'analysis' | 'recap' | 'video';
export type NewsSource = {
  id: string; name: string; home: string; hosts: string[];
  ownershipEvidence: string; permissionEvidence: string;
  permission: 'documented-api' | 'pending' | 'granted'; imageHosts?:string[]; connected: boolean;
  minimumPollMinutes: number | null;
};
export const newsSources:NewsSource[]=pulseSources;
export type MatchTeam = {id:string; name:string; aliases:string[]};
export type MatchGame = {id:string; teamIds:string[]; date:string};
export type Candidate = {
  id:string; sourceId:string; title:string; url:string; kind:NewsKind;
  publishedAt:string|null; updatedAt:string; state?:'published'|'corrected'|'retracted';
  conferenceIds?:string[];contentCategory?:string;
  summary?:string;credit?:string;publishedDate?:string;observedAt?:string;classification?:{category:'breaking'|'highlights'|'routine'|'recaps'|'major';evidence:string};
  football:boolean; teamIds?:string[]; gameId?:string;
  // Only a verified provider/editor can supply these identities, never headline similarity.
  verifiedStoryKey?:string; national?:boolean; fixture?:boolean;
  contentEvidence?:{url:string;resourceId:string;resourceType:'video'|'article';verifiedAt:string};
  image?:{url:string;contentUrl:string;verifiedAt:string;permission:'provider-thumbnail'|'licensed';attribution:string};
};
export type NewsItem = Omit<Candidate,'state'> & {state?:Candidate['state']|'conflicted';teamIds:string[]; gameId?:string; sourceName:string; matchEvidence:string[]; clusterId:string};
const safeId = (v:string) => typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const stamp = (v:string|null) => v === null ? NaN : Date.parse(v);
export function newsUrl(value:string,source:NewsSource,fixture=false):string|null {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || u.port || !source.hosts.includes(u.hostname))return null;
    if(source.id==='army-news'&&!/^\/article\/\d+\/[a-z0-9_/-]+$/.test(u.pathname))return null;
    if(source.id==='kff-news'&&!/^\/news\/article\/[a-z0-9-]+\/?$/.test(u.pathname))return null;
    if(['tennessee-lookout','kentucky-lantern','stateline'].includes(source.id)&&!/^\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/?$/.test(u.pathname))return null;
    if(source.id==='dvids-editorial'&&!/^\/video\/\d+\/[a-z0-9-]+$/.test(u.pathname))return null;
    if(source.id==='tennessee-youtube'||source.id.startsWith('yt-')) {
      if(fixture) {if(u.href!==source.home)return null;}
      else if(u.pathname!=='/watch'||!/^[\w-]{11}$/.test(u.searchParams.get('v')||''))return null;
    }
    for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/.test(key))u.searchParams.delete(key);
    u.hash='';return u.href;
  }catch{return null;}
}
function mentions(title:string,alias:string){
  const escape=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^a-z0-9])${escape}([^a-z0-9]|$)`,'i').test(title);
}
export function matchNews(candidate:Candidate,teams:MatchTeam[],games:MatchGame[]) {
  const evidence:string[]=[];const ids=new Set<string>();
  for(const id of candidate.teamIds||[])if(teams.some(t=>t.id===id)){ids.add(id);evidence.push('Provider team tag: '+id);}
  for(const team of teams)for(const alias of team.aliases){
    if(!mentions(candidate.title,alias))continue;
    if(teams.filter(t=>t.aliases.some(a=>a.toLowerCase()===alias.toLowerCase())).length!==1)continue;
    ids.add(team.id);evidence.push('Unambiguous team name: '+alias);break;
  }
  // A game requires an explicit, known event identity and both matched participants.
  const game=games.find(g=>g.id===candidate.gameId&&g.teamIds.length===2&&g.teamIds.every(id=>ids.has(id))&&Number.isFinite(stamp(g.date))&&candidate.publishedAt&&Math.abs(stamp(g.date)-stamp(candidate.publishedAt))<=2*86400000);
  if(game)evidence.push('Verified schedule identity: '+game.id);
  return {teamIds:[...ids].sort(),gameId:game?.id,matchEvidence:evidence};
}
export function normalizeNews(c:Candidate,teams:MatchTeam[],games:MatchGame[],now:number,allowFixtures=false,allowLive=false):NewsItem|null {
  const source=newsSources.find(s=>s.id===c.sourceId);
  if(!source||!safeId(c.id)||!c.football||!['news','highlight','analysis','recap','video'].includes(c.kind)||typeof c.title!=='string'||!c.title.trim()||c.title.length>250||/[<>\x00-\x1f]/.test(c.title))return null;
  if(c.fixture===true){if(!allowFixtures)return null;}else if(!allowLive||source.permission!=='granted'||!source.connected||!c.contentEvidence||newsUrl(c.contentEvidence.url,source)!==newsUrl(c.url,source)||!Number.isFinite(stamp(c.contentEvidence.verifiedAt))||stamp(c.contentEvidence.verifiedAt)>now)return null;
  if(!Number.isFinite(stamp(c.updatedAt))||stamp(c.updatedAt)>now+60000)return null;
  if(c.publishedAt!==null&&(!Number.isFinite(stamp(c.publishedAt))||stamp(c.publishedAt)>now+60000||stamp(c.publishedAt)>stamp(c.updatedAt)))return null;
  if(c.state&&!['published','corrected','retracted'].includes(c.state))return null;
  const url=newsUrl(c.url,source,c.fixture===true);if(!url)return null;
  const matched=matchNews(c,teams,games);
  return {...c,...matched,title:c.title.trim(),url,sourceName:source.name,clusterId:c.verifiedStoryKey&&safeId(c.verifiedStoryKey)?'story:'+c.verifiedStoryKey:'item:'+c.sourceId+':'+c.id};
}
export function reconcileNews(previous:NewsItem[],incoming:NewsItem[]):NewsItem[] {
  const rows=new Map(previous.map(i=>[i.sourceId+':'+i.id,i]));
  for(const item of incoming){
    const key=item.sourceId+':'+item.id,old=rows.get(key);
    if(old&&stamp(old.updatedAt)>stamp(item.updatedAt))continue;
    if(old&&stamp(old.updatedAt)===stamp(item.updatedAt)){
      const signature=(i:NewsItem)=>JSON.stringify([i.title,i.url,i.kind,i.publishedAt,i.state,i.teamIds,i.gameId,i.summary,i.credit,i.publishedDate,i.image?.url]);
      if(signature(old)!==signature(item))rows.set(key,{...old,state:'conflicted'});
      continue;
    }
    // Stable publication identity: revisions cannot rejuvenate an old story.
    rows.set(key,old?{...item,publishedAt:old.publishedAt}:item);
  }
  return [...rows.values()].sort((a,b)=>stamp(b.updatedAt)-stamp(a.updatedAt)).slice(0,1000);
}
export function visibleNews(items:NewsItem[],now:number,archive=false){
  const clusters=new Set<string>(),urls=new Set<string>();
  return items.filter(i=>i.state!=='retracted'&&i.state!=='conflicted'&&(!(i.publishedAt||i.publishedDate)||now-stamp(i.publishedAt||i.publishedDate!)<=(archive?180:7)*86400000))
    .sort((a,b)=>stamp(b.publishedAt||b.updatedAt)-stamp(a.publishedAt||a.updatedAt))
    .filter(i=>{if(clusters.has(i.clusterId)||(!i.fixture&&urls.has(i.url)))return false;clusters.add(i.clusterId);if(!i.fixture)urls.add(i.url);return true;});
}
export function newsIsStale(item:NewsItem,now:number){return !(item.publishedAt||item.publishedDate)||now-stamp(item.publishedAt||item.publishedDate!)>24*3600000;}
export type NewsAudience = {favorites:{id:string;name:string}[]; following?:{items:{kind:string;id:string;gameId?:string;createdAt:number;expiresAt:number}[]}};
export function newsReasons(item:NewsItem,audience:NewsAudience,now:number):string[]{
  const reasons:string[]=[];
  for(const t of audience.favorites)if(item.teamIds.includes(t.id))reasons.push('Favorite team: '+t.name);
  for(const f of audience.following?.items||[])if(f.createdAt<=now&&f.expiresAt>now){
    if(f.kind==='team'&&item.teamIds.includes(f.id))reasons.push('Temporary team follow');
    if(f.kind==='game'&&item.gameId&&f.gameId===item.gameId)reasons.push('Temporary game follow');
  }
  if(!item.teamIds.length&&item.conferenceIds?.length){for(const t of audience.favorites){const conference=pulseTeams.find(p=>p.id===t.id)?.conference;if(conference&&item.conferenceIds.includes(conference))reasons.push('Conference coverage: '+conference);}}
  return [...new Set(reasons)];
}
export type NewsPacket={version:1;mode:'fixtures'|'unavailable'|'live'|'captured';evaluatedAt:string;items:NewsItem[];sources:NewsSource[];pushDelivery:false;freshness?:{sourceId?:string;status:string;observedAt:string;message:string;lastSuccessAt?:string|null;relevantItems?:number;retrievedItemIds?:string[]}[]};
export function readNewsPacket(value:unknown):NewsPacket|null {
  const p=value as NewsPacket|null;
  if(!p||p.version!==1||!['fixtures','unavailable','live','captured'].includes(p.mode)||p.pushDelivery!==false||!Number.isFinite(stamp(p.evaluatedAt))||!Array.isArray(p.items)||p.items.length>1000||!Array.isArray(p.sources)||(p.mode==='unavailable'&&p.items.length>0))return null;
  for(const i of p.items){
    const s=newsSources.find(s=>s.id===i?.sourceId);
    if(!i||!s||!safeId(i.id)||typeof i.title!=='string'||(p.mode==='fixtures'&&!i.title.startsWith('Sample:'))||i.title.length>250||(p.mode==='fixtures'?i.fixture!==true:i.fixture===true)||!['news','highlight','analysis','recap','video'].includes(i.kind)||!newsUrl(i.url,s,p.mode==='fixtures')||i.sourceName!==s.name||!Number.isFinite(stamp(i.updatedAt))||(i.publishedAt!==null&&!Number.isFinite(stamp(i.publishedAt)))||!Array.isArray(i.teamIds)||i.teamIds.some(id=>typeof id!=='string'||!/^\d{1,12}$/.test(id))||typeof i.clusterId!=='string'||!Array.isArray(i.matchEvidence))return null;
  }
  for(const i of p.items){if(i.summary!==undefined&&(typeof i.summary!=='string'||i.summary.length>500))return null;if(i.credit!==undefined&&(typeof i.credit!=='string'||i.credit.length>200))return null;if(i.publishedDate!==undefined&&(typeof i.publishedDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(i.publishedDate)||!Number.isFinite(Date.parse(i.publishedDate))||new Date(i.publishedDate).toISOString().slice(0,10)!==i.publishedDate))return null;}
  if(p.mode==='live'||p.mode==='captured')for(const i of p.items){const source=newsSources.find(s=>s.id===i.sourceId)!;if(!normalizeNews({...i,state:i.state==='conflicted'?undefined:i.state},[],[],Date.now(),false,true)||source.permission!=='granted')return null;}
  return {...p,sources:newsSources};
}

export {pulseTeamNames};
export function newsStoryPath(item:Pick<NewsItem,'sourceId'|'id'>){return '/pulse/story/'+encodeURIComponent(item.sourceId)+'/'+encodeURIComponent(item.id);}

export function rankPulseItems(items:NewsItem[],audience:NewsAudience,now:number,personalized:boolean){const score=(i:NewsItem)=>{const fresh=!newsIsStale(i,now)?100:0,breaking=i.classification?.category==='breaking'&&i.classification.evidence?20:0,own=personalized?newsReasons(i,audience,now).reduce((n,r)=>n+(r.startsWith('Favorite team')?6:r.startsWith('Temporary game')?7:r.startsWith('Temporary team')?4:1),0):0;return fresh+breaking+own;};return [...items].sort((a,b)=>score(b)-score(a)||Date.parse(b.publishedAt||b.publishedDate||b.updatedAt)-Date.parse(a.publishedAt||a.publishedDate||a.updatedAt));}

export function pulseDiscovery(items:NewsItem[],audience:NewsAudience,now:number,teamId=''){
 const personal=items.filter(i=>teamId?i.teamIds.includes(teamId):newsReasons(i,audience,now).length>0);
 return {items:personal.length?personal:teamId?[]:items,fallback:!teamId&&!personal.length&&items.length>0};
}
