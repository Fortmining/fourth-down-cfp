// News discovery is independent of score-based GameDay Pulse and never sends push.
export const NEWS_PILOT_UI = process.env.NEXT_PUBLIC_FOURTH_DOWN_NEWS_PILOT === 'true';
export type NewsKind = 'news' | 'highlight' | 'analysis' | 'recap';
export type NewsSource = {
  id: string; name: string; home: string; hosts: string[];
  ownershipEvidence: string; permissionEvidence: string;
  permission: 'documented-api' | 'pending'; connected: false;
  minimumPollMinutes: number | null;
};
export const newsSources: NewsSource[] = [
  {id:'tennessee-youtube',name:'Tennessee Athletics · YouTube',home:'https://www.youtube.com/@TennesseeAthletics/featured',hosts:['www.youtube.com'],ownershipEvidence:'https://utsports.com/sports/football',permissionEvidence:'https://developers.google.com/youtube/terms/developer-policies',permission:'documented-api',connected:false,minimumPollMinutes:null},
  {id:'ncaa-football',name:'NCAA.com football',home:'https://www.ncaa.com/news/football/fbs',hosts:['www.ncaa.com'],ownershipEvidence:'https://www.ncaa.com/rss',permissionEvidence:'https://www.ncaa.com/tos',permission:'pending',connected:false,minimumPollMinutes:8},
  {id:'texas-football',name:'Texas Athletics football',home:'https://texaslonghorns.com/sports/football',hosts:['texaslonghorns.com'],ownershipEvidence:'https://texaslonghorns.com/rss_feeds',permissionEvidence:'https://texaslonghorns.com/rss_feeds',permission:'pending',connected:false,minimumPollMinutes:60},
];
export type MatchTeam = {id:string; name:string; aliases:string[]};
export type MatchGame = {id:string; teamIds:string[]; date:string};
export type Candidate = {
  id:string; sourceId:string; title:string; url:string; kind:NewsKind;
  publishedAt:string|null; updatedAt:string; state?:'published'|'corrected'|'retracted';
  football:boolean; teamIds?:string[]; gameId?:string;
  // Only a verified provider/editor can supply these identities, never headline similarity.
  verifiedStoryKey?:string; national?:boolean; fixture?:boolean;
};
export type NewsItem = Omit<Candidate,'state'> & {state?:Candidate['state']|'conflicted';teamIds:string[]; gameId?:string; sourceName:string; matchEvidence:string[]; clusterId:string};
const safeId = (v:string) => typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const stamp = (v:string|null) => v === null ? NaN : Date.parse(v);
export function newsUrl(value:string,source:NewsSource,fixture=false):string|null {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || u.port || !source.hosts.includes(u.hostname))return null;
    if(source.id==='tennessee-youtube') {
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
export function normalizeNews(c:Candidate,teams:MatchTeam[],games:MatchGame[],now:number,allowFixtures=false):NewsItem|null {
  const source=newsSources.find(s=>s.id===c.sourceId);
  if(!source||!safeId(c.id)||!c.football||!['news','highlight','analysis','recap'].includes(c.kind)||typeof c.title!=='string'||!c.title.trim()||c.title.length>250||/[<>\x00-\x1f]/.test(c.title))return null;
  // No live source is connected in this pilot. Network adapters need a later approval.
  if(!allowFixtures||c.fixture!==true)return null;
  if(!Number.isFinite(stamp(c.updatedAt))||stamp(c.updatedAt)>now+60000)return null;
  if(c.publishedAt!==null&&(!Number.isFinite(stamp(c.publishedAt))||stamp(c.publishedAt)>now+60000||stamp(c.publishedAt)>stamp(c.updatedAt)))return null;
  if(c.state&&!['published','corrected','retracted'].includes(c.state))return null;
  const url=newsUrl(c.url,source,true);if(!url)return null;
  const matched=matchNews(c,teams,games);
  return {...c,...matched,title:c.title.trim(),url,sourceName:source.name,clusterId:c.verifiedStoryKey&&safeId(c.verifiedStoryKey)?'story:'+c.verifiedStoryKey:'item:'+c.sourceId+':'+c.id};
}
export function reconcileNews(previous:NewsItem[],incoming:NewsItem[]):NewsItem[] {
  const rows=new Map(previous.map(i=>[i.sourceId+':'+i.id,i]));
  for(const item of incoming){
    const key=item.sourceId+':'+item.id,old=rows.get(key);
    if(old&&stamp(old.updatedAt)>stamp(item.updatedAt))continue;
    if(old&&stamp(old.updatedAt)===stamp(item.updatedAt)){
      const signature=(i:NewsItem)=>JSON.stringify([i.title,i.url,i.kind,i.publishedAt,i.state,i.teamIds,i.gameId]);
      if(signature(old)!==signature(item))rows.set(key,{...old,state:'conflicted'});
      continue;
    }
    // Stable publication identity: revisions cannot rejuvenate an old story.
    rows.set(key,old?{...item,publishedAt:old.publishedAt}:item);
  }
  return [...rows.values()].sort((a,b)=>stamp(b.updatedAt)-stamp(a.updatedAt)).slice(0,1000);
}
export function visibleNews(items:NewsItem[],now:number){
  const clusters=new Set<string>();
  return items.filter(i=>i.state!=='retracted'&&i.state!=='conflicted'&&(!i.publishedAt||now-stamp(i.publishedAt)<=7*86400000))
    .sort((a,b)=>stamp(b.publishedAt||b.updatedAt)-stamp(a.publishedAt||a.updatedAt))
    .filter(i=>{if(clusters.has(i.clusterId))return false;clusters.add(i.clusterId);return true;});
}
export function newsIsStale(item:NewsItem,now:number){return !item.publishedAt||now-stamp(item.publishedAt)>24*3600000;}
export type NewsAudience = {favorites:{id:string;name:string}[]; following?:{items:{kind:string;id:string;gameId?:string;createdAt:number;expiresAt:number}[]}};
export function newsReasons(item:NewsItem,audience:NewsAudience,now:number):string[]{
  const reasons:string[]=[];
  for(const t of audience.favorites)if(item.teamIds.includes(t.id))reasons.push('Favorite team: '+t.name);
  for(const f of audience.following?.items||[])if(f.createdAt<=now&&f.expiresAt>now){
    if(f.kind==='team'&&item.teamIds.includes(f.id))reasons.push('Temporary team follow');
    if(f.kind==='game'&&item.gameId&&f.gameId===item.gameId)reasons.push('Temporary game follow');
  }
  return [...new Set(reasons)];
}
export type NewsPacket={version:1;mode:'fixtures'|'unavailable';evaluatedAt:string;items:NewsItem[];sources:NewsSource[];pushDelivery:false};
export function readNewsPacket(value:unknown):NewsPacket|null {
  const p=value as NewsPacket|null;
  if(!p||p.version!==1||!['fixtures','unavailable'].includes(p.mode)||p.pushDelivery!==false||!Number.isFinite(stamp(p.evaluatedAt))||!Array.isArray(p.items)||p.items.length>1000||!Array.isArray(p.sources)||(p.mode==='unavailable'&&p.items.length>0))return null;
  for(const i of p.items){
    const s=newsSources.find(s=>s.id===i?.sourceId);
    if(!i||!s||!safeId(i.id)||typeof i.title!=='string'||!i.title.startsWith('Sample:')||i.title.length>250||i.fixture!==true||!['news','highlight','analysis','recap'].includes(i.kind)||!newsUrl(i.url,s,true)||i.sourceName!==s.name||!Number.isFinite(stamp(i.updatedAt))||(i.publishedAt!==null&&!Number.isFinite(stamp(i.publishedAt)))||!Array.isArray(i.teamIds)||i.teamIds.some(id=>typeof id!=='string'||!/^\d{1,12}$/.test(id))||typeof i.clusterId!=='string'||!Array.isArray(i.matchEvidence))return null;
  }
  return {...p,sources:newsSources};
}
