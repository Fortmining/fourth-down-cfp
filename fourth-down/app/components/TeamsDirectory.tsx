'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Search,ArrowUpRight} from 'lucide-react';
import {pulseTeams,pulseConferences} from '../lib/pulse-teams';
import AppFrame from './AppFrame';
import TeamMark from './TeamMark';
import {useLiveFeed} from './useTrackerData';
export default function TeamsDirectory(){
 const [query,setQuery]=useState(''),[conference,setConference]=useState('');const {data}=useLiveFeed();
 const logos=new Map(data?.games.flatMap(g=>g.teams).map(t=>[t.id,t.logo])||[]);
 const teams=pulseTeams.filter(t=>(!conference||t.conference===conference)&&t.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
 return <AppFrame title="Find your football." eyebrow="THE NATIONAL TEAM DIRECTORY" description="Every program. Every season-long story. Explore all 138 supported FBS teams."><div className="directoryControls"><label><Search size={18}/><span className="srOnly">Search teams</span><input type="search" placeholder="Search teams…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label><span className="srOnly">Conference</span><select aria-label="Conference" value={conference} onChange={e=>setConference(e.target.value)}><option value="">All conferences</option>{pulseConferences.map(c=><option key={c}>{c}</option>)}</select></label></div><p className="snapshotLabel" role="status">{teams.length} programs · Open to everyone, no follow required</p><div className="teamDirectory">{teams.map(t=><article key={t.id}><Link prefetch={false} className="directoryIdentity" href={'/team/'+t.id}><TeamMark name={t.name} logo={logos.get(t.id)}/><div><small>{t.conference}</small><h2>{t.name}</h2></div><ArrowUpRight size={18}/></Link><nav aria-label={t.name+' destinations'}><Link prefetch={false} href={'/team/'+t.id}>Team center</Link><Link prefetch={false} href={'/recruiting?team='+t.id}>Recruiting</Link><Link prefetch={false} href={'/transfers?team='+t.id}>Portal</Link></nav></article>)}</div>{!teams.length&&<div className="fanEmpty">No matching programs. <button onClick={()=>{setQuery('');setConference('');}}>Clear filters</button></div>}</AppFrame>;
}
