"use client";
import {pulseTeams,pulseConferences} from '../lib/pulse-teams';
import {pulseCoverage,pulseSources} from '../lib/pulse-source-registry';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Newspaper,Play,Radio} from 'lucide-react';
import {readPreferences,CHANGED} from '../lib/following-client';
import {visibleNews,newsReasons,newsIsStale,readNewsPacket,newsStoryPath,pulseTeamNames,rankPulseItems,type NewsAudience,type NewsItem,type NewsPacket} from '../lib/news-pulse';
import NewsMedia from './NewsMedia';
import {newsCardLink,newsCardImage} from '../lib/news-pulse-media';
import AppFrame from './AppFrame';
import './news-pulse.css';

function useNewsPulse(){
  const [packet,setPacket]=useState<NewsPacket|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const [audience,setAudience]=useState<NewsAudience>({favorites:[]});
  useEffect(()=>{const read=()=>setAudience(readPreferences());read();window.addEventListener(CHANGED,read);window.addEventListener('storage',read);return()=>{window.removeEventListener(CHANGED,read);window.removeEventListener('storage',read);};},[]);
  useEffect(()=>{
    const now=Date.now(),next=audience.following?.items.filter(f=>f.expiresAt>now).sort((a,b)=>a.expiresAt-b.expiresAt)[0];
    if(!next)return;
    const timer=setTimeout(()=>setAudience(readPreferences()),Math.min(next.expiresAt-now+10,2147483647));
    return()=>clearTimeout(timer);
  },[audience]); // Expire local feed eligibility without polling or changing follows.
  useEffect(()=>{const controller=new AbortController();let active=true;
    fetch('/api/news-pulse',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])}).then(async r=>{
      if(!r.ok)throw Error();const p=readNewsPacket(await r.json());if(!p)throw Error();
      if(active){setPacket(p);setError('');}
    }).catch(()=>{if(active)setError('Pulse could not be loaded. Retry when connected.');});
    return()=>{active=false;controller.abort();};
  },[revision]);
  return {packet,error,audience,retry:()=>setRevision(n=>n+1)};
}
export function NewsCard({item,packet,reasons=[],featured=false}:{item:NewsItem;packet:NewsPacket;reasons?:string[];featured?:boolean}){
  const source=packet.sources.find(s=>s.id===item.sourceId);const link=source&&newsCardLink(item,source);if(!source||!link)return null;const image=newsCardImage(item,source);
  const stale=newsIsStale(item,Date.parse(packet.evaluatedAt)),categoryLabel:Record<string,string>={'interview':'Interview','promotional':'Promo / spirit video','preview':'Preview','recruiting':'Recruiting','announcement':'Announcement','game-highlights':'Game highlights','recap':'Recap','news':'News'};
  return <article className={"newsPulseCard"+(featured?" isFeatured":"")}><NewsMedia key={image||"fallback"} url={image} title={item.title} kind={item.kind} sample={item.fixture===true} attribution={item.image?.attribution}/><div className="newsCardBody">
    <div className="newsCardTop"><span className="newsKind">{(item.kind==='highlight'||item.kind==='video')?<Play size={15}/>:<Newspaper size={15}/>} {categoryLabel[item.contentCategory||'']||(item.kind==='highlight'?'Highlight':item.kind==='video'?'Publisher video':item.kind==='recap'?'Recap':item.kind==='analysis'?'Analysis':'News')}</span>{item.fixture&&<span className="newsSample">Sample fixture</span>}</div>
    <h3><Link prefetch={false} href={newsStoryPath(item)}>{item.title}</Link></h3><p className="newsAttribution">{item.sourceName}</p>
    <div className="newsTags">{item.state==='corrected'&&<span>{item.fixture?'Corrected sample':'Publisher correction'}</span>}{stale&&<span>{(item.publishedAt||item.publishedDate)?(item.fixture?'Older sample':'Older story'):'Time unavailable'}</span>}{reasons.map(reason=><span key={reason}>{reason}</span>)}</div>
    <p className="newsTime">{item.publishedAt?<><time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}</time>{item.fixture?' · Scenario time':' · Published'}</>:item.publishedDate?`${item.publishedDate} · Publisher date; time zone unavailable`:'Publication time unavailable'}</p>
    {item.state==='corrected'&&<details><summary>What changed?</summary><p>{item.fixture?'Correction-handling demonstration. The original scenario publication time is retained; this is not a new alert.':'See the original publisher for its correction. The original publication time is retained.'}</p></details>}
    <a className="newsSourceLink" href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ArrowUpRight size={16}/><span className="srOnly"> in a new tab</span></a>
    {item.summary&&<p>{item.summary}</p>}<Link prefetch={false} className="newsStoryLink" href={newsStoryPath(item)}>Story & sharing →</Link>{item.fixture&&<small>Not a published story or clip. View sample source opens the official channel, not this fictional content.</small>}</div>
  </article>;
}
function PilotNotice({packet}:{packet:NewsPacket|null}){
  return <aside className="newsPilotNotice"><Radio size={20}/><div><b>{packet?.mode==='fixtures'?'Sample feed · not live news':packet?.mode==='live'?'Official-source pilot · limited coverage':packet?.mode==='captured'?'Verified captures · live source check unavailable':'Development pilot · live sources not connected'}</b><p>Pulse push is OFF. Current coverage is limited to verified permitted sources; videos are labeled by type, not assumed to be game highlights. Immediate or comprehensive coverage is not promised.</p></div></aside>;
}
function Coverage({packet}:{packet:NewsPacket|null}){const report=pulseCoverage(packet?.freshness,packet?.items),[selected,setSelected]=useState(''),row=report.teams.find(t=>t.id===selected);return <details className="newsEvidence" data-testid="pulse-coverage"><summary>Coverage: {report.supportedTeams} FBS programs · {report.configuredLiveTeams} with verified automatic sources</summary><p>{report.teamsWithRetrievedContent} programs appear in automatically retrieved content; {report.healthyLiveTeams} have a configured source confirmed healthy in this packet. {report.coverageGaps} programs still need a verified live source. Architecture support is not a claim of complete news coverage.</p><label>Check a program<select aria-label="Coverage program" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose any FBS program</option>{report.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p role="status">{row?row.name+' · '+row.conference+' · '+row.reason:'Choose a program to see its source status.'}</p><p>Sources: {pulseSources.filter(s=>s.connected&&s.adapter==='rss'&&packet?.freshness?.some(f=>f.sourceId===s.id&&f.status==='checked')).map(s=>s.name).join(', ')}. A configured national feed does not guarantee stories for every team.</p></details>;}
function Sources({packet}:{packet:NewsPacket|null}){
 return <details className="newsEvidence"><summary>Sources, permissions & freshness</summary><p>Sources are configuration-driven across the complete FBS registry. Only permission-cleared, reachable sources are connected; healthy broad feeds may have no qualifying football stories. Editorial video selections are not automatic highlights. YouTube API configuration and other publishers remain disconnected. No article bodies, video downloads, Redis ingestion or Pulse delivery are enabled.</p>{packet?.freshness?.map((f,n)=><p key={n}><b>{f.status}</b> · <time dateTime={f.observedAt}>{f.observedAt}</time><br/>{f.message}</p>)}{packet?.sources.map(s=><div className="newsSourceStatus" key={s.id}><b>{s.name}</b><p>{s.permission==='granted'?'Permission-cleared metadata adapter. Coverage and refresh status are shown above.':s.permission==='pending'?'Reuse permission pending; not connected.':'Supported API adapter; no credentials configured or connection enabled.'}</p><a href={s.ownershipEvidence} target="_blank" rel="noopener noreferrer">Source evidence ↗</a> · <a href={s.permissionEvidence} target="_blank" rel="noopener noreferrer">Permission reference ↗</a></div>)}<p>Publisher rights, credits and original destinations are preserved. Cross-publisher similarity alone does not prove the same event. No government or publisher endorsement of Fourth Down is implied.</p></details>;
}
export function NewsPulsePanel({teamId}:{teamId?:string}){
  const {packet,error,audience,retry}=useNewsPulse();const now=packet?Date.parse(packet.evaluatedAt):Date.now();
  const items=packet?visibleNews(packet.items,now).filter(i=>teamId?i.teamIds.includes(teamId):newsReasons(i,audience,Date.now()).length>0).slice(0,3):[];
  return <section className="newsPulseSection homeSection" aria-labelledby={teamId?'team-news-title':'home-news-title'}><div className="sectionHeading"><div><p className="eyebrow">NEWS & HIGHLIGHTS · PILOT</p><h2 id={teamId?'team-news-title':'home-news-title'}>Fourth Down Pulse</h2></div><Link prefetch={false} href={'/pulse'+(teamId?'?team='+teamId:'')}>See all Pulse →</Link></div>
    <PilotNotice packet={packet}/>{error&&<p role="alert">{error} <button onClick={retry}>Retry Pulse</button></p>}
    <div className="newsPulseGrid">{items.map(i=><NewsCard key={i.sourceId+':'+i.id} item={i} packet={packet!} reasons={newsReasons(i,audience,Date.now())}/>)}</div>
    {!items.length&&<p className="newsEmpty">{!packet&&!error?'Loading Pulse…':teamId?'No verified Pulse items for this team. News, videos and sharing work for every FBS program; source coverage may still be missing.':'No matching Pulse items. Your favorite teams and active temporary follows will shape this feed when sources are connected.'} <Link prefetch={false} href="/pulse">Explore Pulse</Link></p>}
  </section>;
}
export default function NewsPulsePage(){
  const {packet,error,audience,retry}=useNewsPulse();const [view,setView]=useState<'for-you'|'national'>('for-you'),[kind,setKind]=useState('all'),[team,setTeam]=useState(''),[limit,setLimit]=useState(20),[archive,setArchive]=useState(false),[filtersReady,setFiltersReady]=useState(false),[conference,setConference]=useState('');
  useEffect(()=>{const q=new URLSearchParams(location.search),id=q.get('team');if(id&&/^\d{1,12}$/.test(id))setTeam(id);if(q.get('view')==='national')setView('national');else if(!q.has('view')&&!id){const saved=readPreferences();if(!saved.favorites.length&&!(saved.following?.items||[]).some(f=>f.createdAt<=Date.now()&&f.expiresAt>Date.now()))setView('national');}if(['news','highlight'].includes(q.get('kind')||''))setKind(q.get('kind')!);setArchive(q.get('older')==='1');if(pulseConferences.includes(q.get('conference')||''))setConference(q.get('conference')!);setFiltersReady(true);},[]);
  useEffect(()=>{if(!filtersReady)return;const u=new URL(location.href);for(const [key,value] of [['team',team],['view',view==='national'?'national':''],['kind',kind==='all'?'':kind],['older',archive?'1':''],['conference',conference]]){if(value)u.searchParams.set(key,value);else u.searchParams.delete(key);}if(u.href!==location.href)history.replaceState({...history.state},'',u);},[filtersReady,team,view,kind,archive,conference]);
  const now=packet?Date.parse(packet.evaluatedAt):Date.now();
  const all=packet?visibleNews(packet.items,now,archive):[];
  const filtered=all.filter(i=>team?i.teamIds.includes(team):view==='national'?(packet?.mode==='fixtures'?i.national===true:true):newsReasons(i,audience,Date.now()).length>0).filter(i=>kind==='all'||(kind==='news'?!['highlight','video'].includes(i.kind):['highlight','video'].includes(i.kind)));
  const items=rankPulseItems(filtered.filter(i=>!conference||i.conferenceIds?.includes(conference)),audience,now,view==='for-you'&&!team);
  const featured=items.find(i=>i.kind==='highlight'||i.kind==='video');
  const ordered=featured?[featured,...items.filter(i=>i!==featured)]:items;
  const teams=[...new Map([...pulseTeams.map(t=>({id:t.id,name:t.name})),...audience.favorites,...(audience.following?.items||[]).filter(f=>f.kind==='team'&&f.createdAt<=Date.now()&&f.expiresAt>Date.now()).map(f=>({id:f.id,name:'Temporarily followed team '+f.id}))].map(t=>[t.id,t])).values()];
  return <AppFrame title="Your football pulse." eyebrow="FOURTH DOWN PULSE" description="News and highlights from the source. Your teams, your game day.">
    <PilotNotice packet={packet}/><button className="newsRefresh" onClick={retry}>Refresh Pulse</button><div className="newsFilters"><div role="group" aria-label="Pulse view">{(['for-you','national'] as const).map(v=><button key={v} aria-pressed={view===v&&!team} onClick={()=>{setView(v);setTeam('');setLimit(20);}}>{v==='for-you'?'For You':'Around College Football'}</button>)}</div><label>Content<select aria-label="Content" value={kind} onChange={e=>{setKind(e.target.value);setLimit(20);}}><option value="all">All content</option><option value="news">News, analysis & recaps</option><option value="highlight">Highlights & publisher videos</option></select></label><label>Team<select aria-label="Team" value={team} onChange={e=>{setTeam(e.target.value);setLimit(20);}}><option value="">All FBS teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}{team&&!teams.some(t=>t.id===team)&&<option value={team}>Team {team}</option>}</select></label><label>Conference<select aria-label="Conference" value={conference} onChange={e=>setConference(e.target.value)}><option value="">All conferences & independents</option>{pulseConferences.map(c=><option key={c} value={c}>{c}</option>)}</select></label></div>
    {packet&&packet.mode!=='fixtures'&&<label className="newsCheck"><input type="checkbox" checked={archive} onChange={e=>setArchive(e.target.checked)}/>Include older stories & videos (up to six months)</label>}
    {error&&<p role="alert" className="newsEmpty">{error} <button onClick={retry}>Retry Pulse</button></p>}
    <p role="status" className="newsResults">{!packet&&!error?'Loading Pulse…':`${items.length} ${packet?.mode==='fixtures'?'sample':'verified'} items`}{team?' · Team filter':view==='for-you'?' · Favorites and active temporary follows':' · National view'}</p>
    <div className="newsPulseGrid">{ordered.slice(0,limit).map(i=><NewsCard featured={i===featured} key={i.sourceId+':'+i.id} item={i} packet={packet!} reasons={newsReasons(i,audience,Date.now())}/>)}</div>
    {packet&&!items.length&&<div className="newsEmpty"><h2>{packet.mode==='unavailable'?'Live sources are not connected yet.':packet.mode==='fixtures'?'No matching sample items.':'No matching stories.'}</h2><p>{team?'No content is assigned to this team without matching evidence.':view==='for-you'?'For You uses your saved favorites and active follows. Your teams may not be covered by connected sources yet. Browse Around College Football for available stories.':'National items need a verified editorial reason. A new upload alone is not breaking news.'}</p><button onClick={()=>{setTeam('');setConference('');setView('national');}}>Browse available stories</button> <Link prefetch={false} href="/following">Manage your teams →</Link></div>}
    {items.length>limit&&<button onClick={()=>setLimit(n=>n+20)}>Show more Pulse items</button>}
    <Coverage packet={packet}/><Sources packet={packet}/><Link prefetch={false} className="routeLink" href="/settings/pulse">Pulse notification plans & quiet hours →</Link>
  </AppFrame>;
}
