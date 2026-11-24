'use client';

import {useEffect,useState} from 'react';
import {officialFootballEvents} from '../lib/pulse-official-events';
import {footballSigningDates} from '../lib/pulse-desks';
import {currentFootballEvents,ingestFootballEvents,type FootballEvent} from '../lib/pulse-events';
import {followedPlayerTeams,matchesPlayerTeam,playerUpdateTimeline,PLAYER_UPDATE_DAYS} from '../lib/pulse-player-updates';
import {pulseTeams} from '../lib/pulse-teams';
import type {NewsAudience} from '../lib/news-pulse';

export default function PulseEventTracker({desk,team,audience}:{desk:'signing'|'portal'|'recruiting'|'following'|'availability';team:string;audience:NewsAudience}) {
  const [season,setSeason]=useState(desk==='signing'||desk==='recruiting'?2027:2026);
  const [period,setPeriod]=useState('all');
  const [direction,setDirection]=useState('all');
  const [following,setFollowing]=useState(desk==='following');
  const [events,setEvents]=useState<readonly FootballEvent[]>(officialFootballEvents);
  const [coverage,setCoverage]=useState('Checking reviewed player records…');
  const [status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading');
  useEffect(()=>{
    const controller=new AbortController();
    const refresh=async()=>{
      try {
        const response=await fetch('/api/news-pulse/events',{signal:controller.signal});
        if(!response.ok) throw Error('Events unavailable');
        const packet=await response.json();
        if(controller.signal.aborted)return;
        if(!Array.isArray(packet.events)||!Array.isArray(packet.coverage))throw Error('Invalid event packet');
        const checked=currentFootballEvents(ingestFootballEvents([],packet.events));
        setEvents(checked);
        setStatus('ready');
        setCoverage(packet.coverage.some((row:{status:string})=>row.status==='unavailable')?'Some linked bios could not be checked.':'Linked roster bios checked or served from cache.');
      } catch {if(!controller.signal.aborted){setStatus('unavailable');setCoverage('Recent player updates are unavailable. Saved player records remain in history.');}}
    };
    void refresh();
    const timer=window.setInterval(refresh,600000);
    return()=>{controller.abort();window.clearInterval(timer);};
  },[]);
  const now=Date.now();
  const followed=followedPlayerTeams(audience,now);
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
      (!following||matchesPlayerTeam(event,followed)) &&
      (desk==='following'?true:desk==='availability'?event.kind==='availability':desk==='portal'?event.kind==='arrival':event.kind==='signing');
  });
  const timeline=playerUpdateTimeline(records,now);
  const recent=status==='ready'?timeline.recent:[];
  const history=timeline.history;
  const teamName=(id:string)=>audience.favorites.find(row=>row.id===id)?.name||pulseTeams.find(row=>row.id===id)?.name||`Team ${id}`;
  const scope=following?[...followed].map(teamName):team?[teamName(team)]:[];
  const reviewedSchools=[...new Set(events.map(event=>event.school.name))].sort();
  const hasScope=!following||followed.size>0;
  const hasRecords=records.length>0;
  const empty=status==='loading'?'Checking for recent reviewed player updates…':!hasScope?'Follow a team or choose a favorite to see its player updates.':status==='unavailable'?'Recent player updates are unavailable. Saved records can still be viewed in history.':!hasRecords?'Recent player updates are unavailable for these teams; no matching reviewed records are connected yet.':`No recent verified player updates are available in the last ${PLAYER_UPDATE_DAYS} days. Older records are in player record history.`;
  return <section className="newsEmpty" aria-label="Reviewed player events">
    <h2>{desk==='following'?'Player updates for your teams':desk==='availability'?'Verified player availability':desk==='portal'?'Confirmed transfer arrivals':'Confirmed signings'}</h2>
    <p>{following?'Your teams':team?'Selected team':'Team scope'}: {scope.length?scope.join(', '):following?'No favorites or active team follows':'All teams with connected records'}.</p>
    <p>Reviewed source coverage: {reviewedSchools.length?`selected records for ${reviewedSchools.join(', ')}`:'no records connected'}. This is not complete player-news coverage for every FBS team.</p>
    <p role="status">{coverage}</p>
    <div className="newsFilters">
      {desk!=='following'&&<label>Class or roster year<select aria-label="Class or roster year" value={season} onChange={event=>setSeason(Number(event.target.value))}><option value="2026">2026</option><option value="2027">2027</option></select></label>}
      {desk==='signing'&&season===2027&&<label>Signing period<select aria-label="Signing period" value={period} onChange={event=>setPeriod(event.target.value)}>
        <option value="all">All dates</option><option value="early">December early period</option><option value="regular">From February signing day</option>
      </select></label>}
      {desk==='portal'&&team&&<label>Direction<select aria-label="Direction" value={direction} onChange={event=>setDirection(event.target.value)}><option value="all">All moves</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></label>}
      {desk!=='following'&&<label><input type="checkbox" checked={following} onChange={event=>setFollowing(event.target.checked)}/> My teams only</label>}
    </div>
    <div aria-label="Recent player updates">
      <h3>Recent updates · last {PLAYER_UPDATE_DAYS} days</h3>
      <p>Based on when the event happened, not when its source was checked. Month-only dates are kept in history.</p>
      {recent.length?<PlayerRecords records={recent}/>:<p role="status">{empty}</p>}
    </div>
    <details>
      <summary>Player record history ({history.length})</summary>
      <p>Older signings, enrollments and transfers, plus records with month-only dates. These are historical records, not current player news.</p>
      {history.length?<PlayerRecords records={history}/>:<p>No saved historical player records match these teams and filters.</p>}
    </details>
  </section>;
}

function PlayerRecords({records}:{records:readonly FootballEvent[]}){
 return <ol>{records.map(event=><li key={event.id}>
  <strong>{event.player.name}</strong> · {event.player.position} · {event.from?`${event.from.name} → `:''}{event.school.name}
  <div>{event.kind==='arrival'?'Enrollment confirmed':event.kind==='signing'?'Signing confirmed':event.kind==='availability'?'Availability update':event.kind.replaceAll('-',' ')} · <time dateTime={event.precision==='month'?event.eventDate.slice(0,7):event.eventDate}>{event.precision==='month'?event.eventDate.slice(0,7):event.eventDate}</time>{event.precision==='month'?' · Month only':''}</div>
  <a href={event.source.url}>{event.source.publisher} ↗</a>
 </li>)}</ol>;
}
