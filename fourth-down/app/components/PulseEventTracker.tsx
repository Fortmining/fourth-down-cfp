'use client';

import {useEffect,useState} from 'react';
import {officialFootballEvents} from '../lib/pulse-official-events';
import {footballSigningDates} from '../lib/pulse-desks';
import type {FootballEvent} from '../lib/pulse-events';
import type {NewsAudience} from '../lib/news-pulse';

export default function PulseEventTracker({desk,team,audience}:{desk:'signing'|'portal'|'recruiting'|'following'|'availability';team:string;audience:NewsAudience}) {
  const [season,setSeason]=useState(desk==='signing'||desk==='recruiting'?2027:2026);
  const [period,setPeriod]=useState('all');
  const [direction,setDirection]=useState('all');
  const [following,setFollowing]=useState(desk==='following');
  const [events,setEvents]=useState<readonly FootballEvent[]>(officialFootballEvents);
  const [coverage,setCoverage]=useState('Checking linked school bios…');
  useEffect(()=>{
    const controller=new AbortController();
    const refresh=async()=>{
      try {
        const response=await fetch('/api/news-pulse/events',{signal:controller.signal});
        if(!response.ok) throw Error('Events unavailable');
        const packet=await response.json();
        if(controller.signal.aborted)return;
        setEvents(packet.events);
        setCoverage(packet.coverage.some((row:{status:string})=>row.status==='unavailable')?'Some linked bios could not be checked.':'Linked roster bios checked or served from cache.');
      } catch {if(!controller.signal.aborted)setCoverage('Automatic updates unavailable. Showing previously loaded records.');}
    };
    void refresh();
    const timer=window.setInterval(refresh,600000);
    return()=>{controller.abort();window.clearInterval(timer);};
  },[]);
  const now=Date.now();
  const followed=new Set([
    ...audience.favorites.map(item=>item.id),
    ...(audience.following?.items||[]).filter(item=>item.kind==='team'&&item.createdAt<=now&&item.expiresAt>now).map(item=>item.id),
  ]);
  const records=events.filter(event=>{
    const school=event.school.id;
    const former=event.from?.id;
    const matchesTeam=!team||(direction!=='outgoing'&&school===team)||(direction!=='incoming'&&former===team);
    const applies=desk==='signing'&&season===2027&&period!=='all';
    const signingDate=event.eventDate;
    const matchesPeriod=!applies||(event.precision==='day'&&(period==='early'
      ?signingDate>=footballSigningDates.earlyStart&&signingDate<=footballSigningDates.earlyEnd
      :signingDate>=footballSigningDates.regularStart));
    return matchesPeriod && (desk==='following'||event.season===season) && matchesTeam &&
      (!following||followed.has(school)||Boolean(former&&followed.has(former))) &&
      (desk==='following'?true:desk==='availability'?event.kind==='availability':desk==='portal'?event.kind==='arrival':event.kind==='signing');
  });
  const positions=new Map<string,number>();
  for(const event of records) positions.set(event.player.position,(positions.get(event.player.position)||0)+1);
  return <section className="newsEmpty" aria-label="Reviewed player events">
    <h2>{desk==='following'?'Player updates for your teams':desk==='availability'?'Verified player availability':desk==='portal'?'Confirmed transfer arrivals':'Confirmed signings'}</h2>
    <p>Tennessee coverage includes reviewed announcements and selected official roster bios.</p>
    <p role="status">{coverage}</p>
    <div className="newsFilters">
      {desk!=='following'&&<label>Class or roster year<select value={season} onChange={event=>setSeason(Number(event.target.value))}><option value="2026">2026</option><option value="2027">2027</option></select></label>}
      {desk==='signing'&&season===2027&&<label>Signing period<select value={period} onChange={event=>setPeriod(event.target.value)}>
        <option value="all">All dates</option><option value="early">December early period</option><option value="regular">From February signing day</option>
      </select></label>}
      {desk==='portal'&&team&&<label>Direction<select value={direction} onChange={event=>setDirection(event.target.value)}><option value="all">All moves</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></label>}
      {desk!=='following'&&<label><input type="checkbox" checked={following} onChange={event=>setFollowing(event.target.checked)}/> My teams only</label>}
    </div>
    {records.length?<p>{records.length} reviewed records · {[...positions].map(([position,count])=>`${position} ${count}`).join(' · ')}</p>:<p>No reviewed player records match. Class or roster activity may still exist.</p>}
    {records.length>0&&<ol>{records.map(event=><li key={event.id}>
      <strong>{event.player.name}</strong> · {event.player.position} · {event.from?`${event.from.name} → `:''}{event.school.name}
      <div>{event.kind==='arrival'?'Enrollment confirmed':event.kind==='signing'?'Signing confirmed':event.kind==='availability'?'Availability update':event.kind.replaceAll('-',' ')} · {event.precision==='month'?event.eventDate.slice(0,7):event.eventDate}</div>
      <a href={event.source.url}>{event.source.publisher} ↗</a>
    </li>)}</ol>}
  </section>;
}
