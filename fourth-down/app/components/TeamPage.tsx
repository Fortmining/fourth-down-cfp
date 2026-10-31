"use client";
import {useEffect,useState} from 'react';
import TrackerNavigation from './TrackerNavigation';
import {NEWS_PILOT_UI} from '../lib/news-pulse';
import {NewsPulsePanel} from './NewsPulse';
import {FollowButton} from './Following';
import {readAppearance,saveAppearance,type Appearance} from '../lib/appearance';
import {normalizePreferences} from '../lib/alerts';
import {gameResult,validTeamId,mergeTeamGames,type TeamDetail,type TeamGame} from '../lib/team-detail';
import {watchClock} from '../lib/watchlist';

function ScheduleCard({game:g,teamId,next=false}:{game:TeamGame;teamId:string;next?:boolean}) {
 const team=g.teams.find(t=>t.id===teamId),opponent=g.teams.find(t=>t.id!==teamId),result=gameResult(g,teamId);
 const day=new Date(g.date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',...(g.kickoffTbd?{timeZone:'UTC'}:{})});
 const when=g.kickoffTbd?`${day} (ESPN date) · Kickoff time TBD`:new Date(g.date).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 return <article className={`teamScheduleCard${next?' nextTeamGame':''}`}>
  {next&&<span className="badge">{g.status==='in'?'LIVE NOW':'NEXT GAME'}</span>}
  <p className="teamGameMeta">{g.neutralSite?'Neutral site':team?.homeAway==='home'?'Home':team?.homeAway==='away'?'Away':'Venue designation unavailable'} · {when}</p>
  <div className="teamOpponent">{opponent&&<a className="teamProfileLink" href={`/team/${opponent.id}`}>
   {opponent.logo&&<img src={opponent.logo} width="36" height="36" alt="" loading="lazy"/>}<b>{opponent.name}</b></a>}
   <strong>{result?`${result} · `:''}{g.status==='pre'?'—':`${team?.score??'—'} – ${opponent?.score??'—'}`}</strong></div>
  <p>{g.detail}{watchClock(g)&&` · ${watchClock(g)}`}{g.status==='post'&&!g.completed?' · Final result not verified':''}</p>
  <p className="teamGameMeta">{g.broadcast||'TV not announced'}{g.venue&&` · ${g.venue}`}</p>
  <a className="teamGameLink" href={`/game/${g.id}`}>Game details <span className="srOnly">for {g.name}</span> →</a>
 </article>;
}
const prefsKey='fourth-down-alert-preferences-v1';
export default function TeamPage({id}:{id:string}) {
 const [data,setData]=useState<TeamDetail|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0);
 const [appearance,setAppearance]=useState<Appearance>('light'),[theme,setTheme]=useState('stadium'),[favorite,setFavorite]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{setAppearance(readAppearance());try{const t=localStorage.getItem('fourth-down-theme');if(t&&['stadium','turf','prime'].includes(t))setTheme(t);setFavorite(normalizePreferences(JSON.parse(localStorage.getItem(prefsKey)||'null')).favorites.some(t=>t.id===id));}catch{}},[id]);
 useEffect(()=>{
  const controller=new AbortController();let running=false;
  async function refresh(){if(running)return;if(!validTeamId(id)){setError('This link has an invalid team identifier.');setBusy(false);return;}running=true;setBusy(true);
   try{const r=await fetch(`/api/teams/${id}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});if(!r.ok)throw Error();const f=await r.json();if(f.id!==id||!Array.isArray(f.games)||!Array.isArray(f.stats))throw Error();if(!controller.signal.aborted){setData(previous=>({...f,games:mergeTeamGames(previous?.id===id?previous.games.filter(g=>!f.scheduleAvailable||f.games.some((x:TeamGame)=>x.id===g.id)):[],f.games,id)}));setError('');}}
   catch{if(!controller.signal.aborted)setError('Could not refresh team information. Any previous snapshot remains visible. Retry when connected.');}
   finally{running=false;if(!controller.signal.aborted)setBusy(false);}}
  void refresh();const visible=()=>{if(!document.hidden)void refresh();};const interval=setInterval(visible,60000);document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);
  return()=>{controller.abort();clearInterval(interval);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);};
 },[id,revision]);
 function toggleFavorite(){if(!data)return;try{const p=normalizePreferences(JSON.parse(localStorage.getItem(prefsKey)||'null'));const exists=p.favorites.some(t=>t.id===id);if(!exists&&p.favorites.length>=20){setMessage('You can select up to 20 teams. Manage favorites in Notifications.');return;}p.favorites=exists?p.favorites.filter(t=>t.id!==id):[...p.favorites,{id,name:data.name}];localStorage.setItem(prefsKey,JSON.stringify(p));localStorage.setItem('fourth-down-alert-settings-pending-v1','true');setFavorite(!exists);setMessage('Favorite saved on this device. Save Changes in Notifications to apply it to alerts.');}catch{setMessage('Browser storage is unavailable. Favorite could not be saved.');}}
 const completed=data?.games.filter(g=>g.completed)||[],upcoming=data?.games.filter(g=>!g.completed)||[];
 const next=upcoming.find(g=>g.status==='in')||upcoming.find(g=>g.status==='pre'&&Date.parse(g.date)>=Date.now());
 return <div className="shell detailShell teamPage" data-appearance={appearance} data-theme={theme}>
  <a className="skip" href="#detail">Skip to team</a><div className="siteHeader"><a className="brand" href="/">FOURTH DOWN</a><TrackerNavigation detail/></div>
  <main id="detail"><div className="teamToolbar"><button onClick={()=>history.length>1?history.back():location.assign('/')}>← Back</button><button disabled={busy} onClick={()=>setRevision(v=>v+1)}>{busy?'Refreshing…':'Refresh team'}</button>
   <label>Appearance<select aria-label="Appearance" value={appearance} onChange={e=>{const a=e.target.value as Appearance;setAppearance(a);saveAppearance(a);}}><option value="light">Light</option><option value="dark">Dark</option></select></label>
   <label>Colorway<select aria-label="Colorway" value={theme} onChange={e=>{setTheme(e.target.value);try{localStorage.setItem('fourth-down-theme',e.target.value);}catch{}}}><option value="stadium">Stadium Gold</option><option value="turf">Turf Electric</option><option value="prime">Prime Time</option></select></label></div>
   <header className="teamHero">{data?.logo&&<img src={data.logo} width="88" height="88" alt=""/>}<div><p className="eyebrow">2026 TEAM CENTER</p><h1>{data?.name||(busy?'Loading team…':'Team unavailable')}</h1><p>{data?.conference||'Conference unavailable'}{data?.nickname&&` · ${data.nickname}`}</p></div></header>
   {error&&<p role="alert" className="teamWarning">{error}</p>}
   {!data&&!busy&&<p><a href="/games">Browse games</a> or retry this team.</p>}
   {data&&<><nav className="teamSections" aria-label="Team sections"><a href="#overview">Overview</a><a href="#schedule">Schedule</a><a href="#stats">Stats</a></nav>
    <p className="teamFreshness">Updated {new Date(data.observedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'})} · ESPN</p>
    {data.warnings.length>0&&<details className="teamWarning"><summary>Some team data is unavailable</summary><ul>{data.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>}
    <section id="overview" aria-labelledby="overview-heading"><h2 id="overview-heading">Overview</h2><div className="teamRecordGrid"><article><h3>Overall</h3><strong>{data.record?.status==='available'?data.record.overall:'Unavailable'}</strong></article><article><h3>Conference</h3><strong>{data.record?.status==='available'?data.record.conference||'Unavailable':'Unavailable'}</strong></article></div>
     <p>Current overall record: {data.record?.status==='available'?data.record.overall:'Unavailable'}{data.record?.conference&&` · Conference: ${data.record.conference}`}</p>
     <p className="teamFreshness">{data.record?.source||'Record source unavailable'}{data.record&&` · Observed ${new Date(data.record.observedAt).toLocaleString()}`}</p>
     <p>Mascot: {data.mascot||'Not available'}</p><p>{data.standing?`ESPN standing: ${data.standing}`:'Conference standing unavailable.'} <small>Reported standing is not championship qualification or a verified tiebreaker decision.</small></p>
     <div className="teamActions"><FollowButton kind="team" id={id} name={data.name} games={data.games}/><button className="detailButton" aria-pressed={favorite} onClick={toggleFavorite}>{favorite?'Remove favorite':'Add favorite'}</button><a href="/settings#alerts">Notification settings</a></div><p role="status">{message}</p>
     <section aria-label="Published rankings for this team"><h3>Official published rankings</h3><div className="teamPollGrid">{(['ap','coaches','cfp'] as const).map(source=>{const p=data.polls.find(p=>p.id===source),row=p?.teams.find(t=>t.teamId===id);return <article key={source}><h4>{source==='ap'?'AP Top 25':source==='coaches'?'Coaches':'CFP'}</h4><strong>{row?`No. ${row.rank}`:p?.teams.length?'Unranked':'Unavailable'}</strong><p>{p?.date?`Published ${new Date(p.date).toLocaleDateString(undefined,{timeZone:'UTC'})}`:p?.message||'No verified edition available'}</p>{p?.status==='awaiting_update'&&<small>Previous published edition; awaiting update.</small>}</article>;})}</div><p className="teamFreshness">Official poll positions retain their publication dates. Fourth Down projections are separate and are not activated here.</p></section>
    </section>
    <section id="schedule" aria-labelledby="schedule-heading"><h2 id="schedule-heading">2026 season schedule</h2><p>{data.games.length} ESPN-supplied fixtures. Times use your device’s time zone. Unannounced games, bowls and championship participants are not inferred.</p>{!data.scheduleAvailable&&<p role="status">Partial schedule — a source could not be verified. Retry to check for missing games.</p>}
     {next&&<div aria-label="Next game"><ScheduleCard game={next} teamId={id} next/></div>}
     <h3>Live & upcoming</h3>{upcoming.filter(g=>g.id!==next?.id).map(g=><ScheduleCard key={g.id} game={g} teamId={id}/>)}{!upcoming.length&&<p>No live or upcoming fixtures supplied by ESPN.</p>}
     <h3>Completed games</h3>{completed.map(g=><ScheduleCard key={g.id} game={g} teamId={id}/>)}{!completed.length&&<p>No verified completed games available.</p>}
    </section>
    <section id="stats" aria-labelledby="stats-heading"><h2 id="stats-heading">Team statistics</h2><p>2026 regular season{data.statisticsGames!==null&&data.statisticsGames!==undefined?` · ${data.statisticsGames} games in ESPN statistics`:''}. Statistics can lag behind confirmed game results.</p><div className="teamStatsGrid">{data.stats.map(s=><article key={s.id}><h3>{s.label}</h3><strong>{s.value??'Unavailable'}</strong><p>{s.espnRank?`ESPN rank: ${s.espnRank}`:'ESPN rank unavailable'}</p><small>{s.basis}</small></article>)}</div><details><summary>Statistics sources & ranking scope</summary><p>Values and ranks are supplied by ESPN. Its statistics feed does not identify the FBS/FCS ranking scope; those ranks are shown as ESPN ranks only. Verified FBS national and conference statistical ranks are unavailable. No ranks or missing statistics are estimated.</p><p>Defensive sacks, tackles and interceptions are season totals. Points and yards per game are explicitly supplied averages.</p></details></section>
    {NEWS_PILOT_UI&&<NewsPulsePanel teamId={id}/>}
    <details className="teamSources"><summary>Data sources & freshness</summary><p>Assembled {new Date(data.observedAt).toLocaleString(undefined,{timeZoneName:'short'})}. Refreshes every minute while visible. ESPN updates may be delayed. Overview and schedules cache for up to one minute; statistics for five minutes. Website responses can serve the previous minute while refreshing. These are retrieval/assembly timestamps, not ESPN publication times.</p><ul>{data.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">ESPN {s.label} ↗</a></li>)}</ul></details>
   </>}
  </main><footer><a href="/">Back to Fourth Down</a><p>Independent, unofficial tracker. ESPN data may be delayed or revised.</p></footer><TrackerNavigation mobile detail/>
 </div>;
}
