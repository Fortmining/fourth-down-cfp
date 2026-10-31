"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Newspaper,Play,Radio} from 'lucide-react';
import {readPreferences,CHANGED} from '../lib/following-client';
import {visibleNews,newsReasons,newsIsStale,newsUrl,readNewsPacket,type NewsAudience,type NewsItem,type NewsPacket} from '../lib/news-pulse';
import NewsPulsePreferences from './NewsPulsePreferences';
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
function NewsCard({item,packet,reasons=[]}:{item:NewsItem;packet:NewsPacket;reasons?:string[]}){
  const source=packet.sources.find(s=>s.id===item.sourceId);const url=source&&newsUrl(item.url,source,item.fixture===true);if(!url)return null;
  const stale=newsIsStale(item,Date.parse(packet.evaluatedAt));
  return <article className="newsPulseCard">
    <div className="newsCardTop"><span className="newsKind">{item.kind==='highlight'?<Play size={15}/>:<Newspaper size={15}/>} {item.kind==='highlight'?'Highlight':item.kind==='recap'?'Recap':item.kind==='analysis'?'Analysis':'News'}</span><span className="newsSample">Sample fixture</span></div>
    <h3>{item.title}</h3><p className="newsAttribution">{item.sourceName}</p>
    <div className="newsTags">{item.state==='corrected'&&<span>Corrected sample</span>}{stale&&<span>{item.publishedAt?'Older sample':'Time unavailable'}</span>}{reasons.map(reason=><span key={reason}>{reason}</span>)}</div>
    <p className="newsTime">{item.publishedAt?<><time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}</time> · Scenario time</>:'Publication time unavailable'}</p>
    {item.state==='corrected'&&<details><summary>What changed?</summary><p>Correction-handling demonstration. The original scenario publication time is retained; this is not a new alert.</p></details>}
    <a className="newsSourceLink" href={url} target="_blank" rel="noopener noreferrer">Open official channel <ArrowUpRight size={16}/><span className="srOnly"> in a new tab</span></a>
    <small>Sample content, not a published story or clip. The link opens the official channel.</small>
  </article>;
}
function PilotNotice({packet}:{packet:NewsPacket|null}){
  return <aside className="newsPilotNotice"><Radio size={20}/><div><b>{packet?.mode==='fixtures'?'Local sample feed · not live news':'Development pilot · live sources not connected'}</b><p>No Pulse push delivery. Stories and clips appear only after publication by an approved source; immediate highlights and complete breaking-news coverage are not promised.</p></div></aside>;
}
function Sources({packet}:{packet:NewsPacket|null}){
  return <details className="newsEvidence"><summary>Sources, permissions & freshness</summary><p>Shared discovery is not connected in this pilot. No publisher API, Redis or subscription is called by this feed. Sample timestamps describe an offline scenario, not current events.</p>{packet?.sources.map(s=><div className="newsSourceStatus" key={s.id}><b>{s.name}</b><p>{s.permission==='pending'?'Public feed reuse permission pending.':'Supported API terms identified; channel ID, credentials and connection not configured.'}{s.minimumPollMinutes&&` Minimum planned check interval: ${s.minimumPollMinutes} minutes, subject to publisher rules and approval.`}</p><a href={s.ownershipEvidence} target="_blank" rel="noopener noreferrer">Publisher/source evidence ↗</a> · <a href={s.permissionEvidence} target="_blank" rel="noopener noreferrer">Permission reference ↗</a></div>)}<p>ESPN and theScore ingestion is excluded. No article bodies, video downloads or publisher images are stored. Permanent favorites and temporary follows remain separate. Undated, old, withdrawn and conflicting content must not trigger future breaking alerts.</p></details>;
}
export function NewsPulsePanel({teamId}:{teamId?:string}){
  const {packet,error,audience,retry}=useNewsPulse();const now=packet?Date.parse(packet.evaluatedAt):Date.now();
  const items=packet?visibleNews(packet.items,now).filter(i=>teamId?i.teamIds.includes(teamId):newsReasons(i,audience,Date.now()).length>0).slice(0,3):[];
  return <section className="newsPulseSection homeSection" aria-labelledby={teamId?'team-news-title':'home-news-title'}><div className="sectionHeading"><div><p className="eyebrow">NEWS & HIGHLIGHTS · PILOT</p><h2 id={teamId?'team-news-title':'home-news-title'}>Fourth Down Pulse</h2></div><Link prefetch={false} href={'/pulse'+(teamId?'?team='+teamId:'')}>See all Pulse →</Link></div>
    <PilotNotice packet={packet}/>{error&&<p role="alert">{error} <button onClick={retry}>Retry Pulse</button></p>}
    <div className="newsPulseGrid">{items.map(i=><NewsCard key={i.sourceId+':'+i.id} item={i} packet={packet!} reasons={newsReasons(i,audience,Date.now())}/>)}</div>
    {!items.length&&<p className="newsEmpty">{!packet&&!error?'Loading Pulse…':teamId?'No verified Pulse items for this team. Source coverage is still being prepared.':'No matching Pulse items. Your favorite teams and active temporary follows will shape this feed when sources are connected.'} <Link prefetch={false} href="/pulse">Explore Pulse</Link></p>}
  </section>;
}
export default function NewsPulsePage(){
  const {packet,error,audience,retry}=useNewsPulse();const [view,setView]=useState<'for-you'|'national'>('for-you'),[kind,setKind]=useState('all'),[team,setTeam]=useState(''),[limit,setLimit]=useState(20);
  useEffect(()=>{const id=new URLSearchParams(location.search).get('team');if(id&&/^\d{1,12}$/.test(id))setTeam(id);},[]);
  const now=packet?Date.parse(packet.evaluatedAt):Date.now();
  const all=packet?visibleNews(packet.items,now):[];
  const items=all.filter(i=>team?i.teamIds.includes(team):view==='national'?i.national===true:newsReasons(i,audience,Date.now()).length>0).filter(i=>kind==='all'||(kind==='news'?i.kind!=='highlight':i.kind==='highlight'));
  const teams=[...new Map([...audience.favorites,...(audience.following?.items||[]).filter(f=>f.kind==='team'&&f.createdAt<=Date.now()&&f.expiresAt>Date.now()).map(f=>({id:f.id,name:'Temporarily followed team '+f.id}))].map(t=>[t.id,t])).values()];
  return <AppFrame title="Your football pulse." eyebrow="FOURTH DOWN PULSE" description="News and highlights from the source. Your teams, your game day.">
    <PilotNotice packet={packet}/><div className="newsFilters"><div role="group" aria-label="Pulse view">{(['for-you','national'] as const).map(v=><button key={v} aria-pressed={view===v&&!team} onClick={()=>{setView(v);setTeam('');setLimit(20);}}>{v==='for-you'?'For You':'Around College Football'}</button>)}</div><label>Content<select aria-label="Content" value={kind} onChange={e=>{setKind(e.target.value);setLimit(20);}}><option value="all">All content</option><option value="news">News, analysis & recaps</option><option value="highlight">Highlights</option></select></label><label>Team<select aria-label="Team" value={team} onChange={e=>{setTeam(e.target.value);setLimit(20);}}><option value="">All teams in this view</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}{team&&!teams.some(t=>t.id===team)&&<option value={team}>Team {team}</option>}</select></label></div>
    {error&&<p role="alert" className="newsEmpty">{error} <button onClick={retry}>Retry Pulse</button></p>}
    <p role="status" className="newsResults">{!packet&&!error?'Loading Pulse…':`${items.length} ${packet?.mode==='fixtures'?'sample':'verified'} items`}{team?' · Team filter':view==='for-you'?' · Favorites and active temporary follows':' · National view'}</p>
    <div className="newsPulseGrid">{items.slice(0,limit).map(i=><NewsCard key={i.sourceId+':'+i.id} item={i} packet={packet!} reasons={newsReasons(i,audience,Date.now())}/>)}</div>
    {packet&&!items.length&&<div className="newsEmpty"><h2>{packet.mode==='unavailable'?'Live sources are not connected yet.':'No matching sample items.'}</h2><p>{team?'No content is assigned to this team without matching evidence.':view==='for-you'?'For You uses your saved favorite teams and active temporary follows. No team is added automatically.':'National items need a verified editorial reason. A new upload alone is not breaking news.'}</p><Link prefetch={false} href="/following">Manage your teams →</Link></div>}
    {items.length>limit&&<button onClick={()=>setLimit(n=>n+20)}>Show more Pulse items</button>}
    <Sources packet={packet}/><NewsPulsePreferences/>
  </AppFrame>;
}
