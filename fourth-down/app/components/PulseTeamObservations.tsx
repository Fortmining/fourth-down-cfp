'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import AccessibleDialog from './AccessibleDialog';
import type {NewsAudience} from '../lib/news-pulse';
import {pulseTeams} from '../lib/pulse-teams';

type Edition<T>={source:string;observedAt:number;year:number;inLatest:boolean;value:T};
type Prospect={id:string;name:string;position:string;stars:number|null;rank:number|null};
type Transfer={name:string;origin:string;destination:string;position:string;date:string};
type Group={count:number;examples:Transfer[];positions?:Record<string,number>};
type Data={
 roster?:Edition<{listed:number;positions:Record<string,number>}>;
 recruits?:Edition<{reported:number;prospects:Prospect[]}>;
 classRank?:Edition<{rank?:number}>;
 transfers?:Edition<{incoming:Group;outgoing:Group}>;
 analytics?:Edition<Record<string,number>>;
 teamStats?:Edition<Record<string,number>>;
 playerStats?:Edition<{leaders:{id:string;name:string;category:string;yards:number}[]}>;

};
function Credit({row}:{row:Edition<unknown>}) {
 return <small>{row.year} · <a href={row.source.includes('cfbfastR')?'https://github.com/sportsdataverse/cfbfastR-data/tree/d48ef3c6a28c003e00c79d3fab4b998eb7869638/rosters':'https://collegefootballdata.com/'}>{row.source}</a> · Observed {new Date(row.observedAt*1000).toLocaleDateString()}
  {!row.inLatest&&' · Last known record; absent from latest dataset'}</small>;
}
export default function PulseTeamObservations({desk,team,setTeam,audience}:{desk:string;team:string;setTeam:(id:string)=>void;audience:NewsAudience}){
 const now=Date.now();
 const followed=audience.following?.items.find(f=>f.kind==='team'&&f.createdAt<=now&&f.expiresAt>now);
 const selected=team||audience.favorites[0]?.id||followed?.id||'';
 const [opponent,setOpponent]=useState('');
 const primary=useTeamObservation(selected);
 const comparison=useTeamObservation(desk==='team'&&opponent!==selected?opponent:'');
 const data=primary?.data;
 const recruiting=desk==='signing'||desk==='recruiting';
 const available=recruiting?data?.recruits||data?.classRank:desk==='portal'?data?.transfers:data?.analytics||data?.roster||data?.teamStats||data?.playerStats;
 return <section className="newsEmpty scoutingPanel" aria-label="Team observations">
  <h2>{recruiting?'Reported recruiting class':desk==='portal'?'Transfer records by season':'Team scouting'}</h2>
  <label>Scouting team <select value={selected} onChange={event=>setTeam(event.target.value)}>
    <option value="">Choose a team</option>{pulseTeams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
  </select></label>
  {primary?.stale&&<p role="status">Showing the last verified team records while updates are unavailable. Check each observation date below.</p>}
  {selected&&!available&&<p role="status">{!primary?'Loading team records…':'No sourced edition available for this team and view.'}</p>}
  {recruiting&&data?.recruits&&<><p>{data.recruits.value.reported} reported commitments. See the separate confirmed-signing timeline for official signings.</p>
   <div className="prospectGrid">{data.recruits.value.prospects.map(p=><article className="prospectCard" key={p.id}><span className="statusTag">Reported commitment</span><div className="prospectIdentity"><span className="playerAvatar" aria-hidden="true">{p.name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span><div><h3>{p.name}</h3><small>{p.position||'Position unlisted'}</small></div></div><div className="prospectMetrics"><span>{p.stars?`${p.stars} ★`:'Stars unavailable'}</span><span>{p.rank?`No. ${p.rank} recruit`:'Rank unavailable'}</span></div></article>)}</div><Credit row={data.recruits}/></>}
  {recruiting&&selected&&primary&&!data?.classRank?.value.rank&&<p>Class ranking is currently unavailable{data?.recruits?.year?` for ${data.recruits.year}`:''}. Reported commitments remain separate from official signings.</p>}
  {recruiting&&data?.classRank?.value.rank&&<p>Class ranking · No. {data.classRank.value.rank} <Credit row={data.classRank}/></p>}
  {desk==='portal'&&data?.transfers&&<>{(['incoming','outgoing'] as const).map(key=>{
   const group=data.transfers!.value[key];return <div key={key}><h3>{key==='incoming'?'Reported destinations':'Reported departures'} · {group.count}</h3>
    {group.positions&&<p>{positionSummary(group.positions)}</p>}
    <div className="transferRows">{group.examples.map((p,i)=><article key={i}><span className="playerAvatar" aria-hidden="true">{p.name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span><div><h4>{p.name} <small>{p.position||'Position unlisted'}</small></h4><p>{p.origin} <span aria-label="to">→</span> {p.destination||'Destination undisclosed'}</p><small className="statusTag">Reported · {p.date?p.date.slice(0,10):'Date unavailable'}</small></div></article>)}</div></div>;
  })}<p>Historical season records. Portal entry, withdrawal and enrollment require separate evidence.</p><Credit row={data.transfers}/></>}
  {desk==='team'&&data?.roster&&<><p>{data.roster.value.listed} players listed on the roster</p>
    <p>{Object.entries(data.roster.value.positions).sort((a,b)=>b[1]-a[1]).map(([p,n])=>p+' '+n).join(' · ')}</p><Credit row={data.roster}/></>}
  {desk==='team'&&selected&&<label>Compare with <select value={opponent===selected?'':opponent} onChange={event=>setOpponent(event.target.value)}>
    <option value="">Choose an opponent</option>{pulseTeams.filter(t=>t.id!==selected).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
  </select></label>}
  {desk==='team'&&(data?.analytics||data?.teamStats||(opponent&&opponent!==selected))&&
    <div className="newsPulseGrid">
      <StatLine team={selected} data={data}/>
      {opponent&&opponent!==selected&&<StatLine team={opponent} data={comparison?.data}/>}
    </div>}
  {desk==='team'&&selected&&primary&&!data?.playerStats&&<p>Season yardage leaders are currently unavailable. Roster and team statistics remain available where shown.</p>}
  {desk==='team'&&data?.playerStats&&<details><summary>Season yardage leaders</summary>
    <ul>{data.playerStats.value.leaders.map(p=><li key={p.category+':'+p.id}>{p.name} · {p.yards.toLocaleString()} {p.category} yards</li>)}</ul>
    <Credit row={data.playerStats}/></details>}
 </section>;
}

export function useTeamObservation(id:string){
 const [packet,setPacket]=useState<{id:string;data:Data|null;stale?:boolean}|null>(null);
 useEffect(()=>{
   if(!id)return;
   const controller=new AbortController();
   fetch('/api/news-pulse/intelligence/'+encodeURIComponent(id),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])})
    .then(async response=>{if(!response.ok)throw Error();return response.json();})
    .then(result=>{if(!controller.signal.aborted)setPacket({id,data:result?.view?.datasets||null,stale:result?.stale===true});})
    .catch(()=>{if(!controller.signal.aborted)setPacket({id,data:null});});
   return ()=>controller.abort();
 },[id]);
 return id&&packet?.id===id?packet:null;
}

const positionSummary=(positions:Record<string,number>)=>Object.entries(positions).sort((a,b)=>b[1]-a[1]).map(([p,n])=>p+' '+n).join(' · ');
const teamMetrics={totalYards:'Total yards',rushingYards:'Rushing yards',netPassingYards:'Net passing yards',turnovers:'Turnovers',interceptions:'Interceptions'};

function StatLine({team,data}:{team:string;data?:Data|null}){
 return <div><h3>{pulseTeams.find(row=>row.id===team)?.name||'Team'}</h3>
  {data?.analytics&&<><dl>{(['offense','defense'] as const).map(side=>{
   const rate=data.analytics!.value[side+'_successRate'];
   return <div key={side}><dt>{side==='offense'?'Offensive success rate':'Opponent success rate'}</dt>
    <dd>{typeof rate==='number'?(100*rate).toFixed(1)+'%':'Unavailable'}</dd></div>;
  })}</dl><Credit row={data.analytics}/></>}
  {data?.teamStats&&<><dl>{Object.entries(teamMetrics).flatMap(([key,label])=>{
    const value=data.teamStats!.value[key];
    return typeof value==='number'?[<div key={key}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>]:[];
  })}</dl><Credit row={data.teamStats}/></>}
  {!data?.analytics&&!data?.teamStats&&<p>No comparable statistics available.</p>}
 </div>;
}

export function TeamPlayerLeaders({team}:{team:string}){
 const packet=useTeamObservation(team),edition=packet?.data?.playerStats;
 const [selected,setSelected]=useState<string|null>(null);
 const leaders=edition?.value.leaders||[],player=leaders.find(p=>p.id===selected);
 return <section className="homeSection playerLeaders" id="players" aria-labelledby="player-leaders-title"><div className="sectionHeading"><div><p className="eyebrow">THE PLAYMAKERS</p><h2 id="player-leaders-title">Season yardage leaders</h2></div><Link href={'/recruiting?team='+team}>Recruiting ↗</Link></div>{packet?.stale&&<p role="status">Last verified records. Check the season and observation date.</p>}<div className="leaderGrid">{leaders.map(p=><button className="leaderCard" key={p.id+':'+p.category} onClick={()=>setSelected(p.id)}><span className="playerAvatar" aria-hidden="true">{p.name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span><span><small>{edition?.year} · {p.category}</small><b>{p.name}</b></span><strong>{p.yards.toLocaleString()}<small>yards ↗</small></strong></button>)}</div>{edition?<Credit row={edition}/>:<p className="fanEmpty" role="status">{!packet?'Loading sourced season leaders…':'Season player statistics are unavailable for this program. Team statistics and schedules remain below.'}</p>}{player&&edition&&<AccessibleDialog id="player-profile" className="playerProfile" label={player.name+' player statistics'} onClose={()=>setSelected(null)}><button className="profileClose" onClick={()=>setSelected(null)} aria-label="Close player profile">×</button><span className="playerAvatar profileAvatar" aria-hidden="true">{player.name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span><p className="eyebrow">{edition.year} · {pulseTeams.find(t=>t.id===team)?.name}</p><h2>{player.name}</h2><div className="profileMetrics">{leaders.filter(p=>p.id===selected).map(p=><article key={p.category}><small>{p.category} yards</small><strong>{p.yards.toLocaleString()}</strong></article>)}</div><Credit row={edition}/><p className="snapshotLabel">Season totals from the supplied dataset. Game logs and a licensed player portrait are not available in this record.</p><Link href={'/team/'+team}>Team center →</Link></AccessibleDialog>}</section>;
}
