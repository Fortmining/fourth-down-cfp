'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import AppFrame from './AppFrame';
import PlayoffNavigation from './PlayoffNavigation';
import ConnectedBracket from './ConnectedBracket';
import {useLiveFeed} from './useTrackerData';
import {conferenceLabel,referenceField,CFP_2026_PROTOCOL} from '../lib/playoff-outlook';
import {pulseTeams} from '../lib/pulse-teams';
import officialManifest from '../data/official-playoff-2026.json';
import {verifiedOfficialField,officialAdvancement,type OfficialField} from '../lib/official-playoff';
import type {Game} from '../lib/tracker-types';
import type {BracketPicks} from '../lib/bracket-predictor';
import {displayRecord} from '../lib/playoff/record-view';
export default function PlayoffDashboard(){
 const {data,busy,error}=useLiveFeed();const [mode,setMode]=useState<'projected'|'official'|'whatif'>('projected'),[picks,setPicks]=useState<BracketPicks>({});
 const poll=data?.polls.find(p=>p.id==='cfp'&&p.teams.length===25)??data?.polls.find(p=>p.id===data.defaultRankingSource&&p.teams.length===25);
 const conferences=Object.fromEntries(pulseTeams.map(t=>[t.id,conferenceLabel(t.conference)]));
 const champions=Object.fromEntries(['ACC','Big Ten','Big 12','SEC'].map(c=>[c,[...(poll?.teams||[])].sort((a,b)=>a.rank-b.rank).find(t=>conferences[t.teamId]===c)?.teamId||'']));
 const field=referenceField(poll,conferences,{champions,eligibilityAssumed:true,reserveUnknownRepresentative:true});
 const officialField=officialManifest as OfficialField,hasOfficial=verifiedOfficialField(officialField);
 const [archivedGames,setArchivedGames]=useState<Record<string,Game>>({});
 // Only reconciled official event IDs are fetched. Keep verified old finals available after
 // they leave the national scoreboard window. Current scoreboard data wins on corrections.
 useEffect(()=>{
  if(!hasOfficial)return;const control=new AbortController();
  const ids=Object.values(officialField.gameIds).filter(id=>!data?.games.some(g=>g.id===id)&&!archivedGames[id]?.completed);
  void Promise.all(ids.map(async id=>{try{const r=await fetch('/api/games/'+id,{signal:AbortSignal.any([control.signal,AbortSignal.timeout(8000)])});if(!r.ok)return;const body=await r.json();if(body.game?.id===id&&!control.signal.aborted)setArchivedGames(old=>({...old,[id]:body.game}));}catch{ /* Missing finals never advance a team. */ }}));
  return()=>control.abort();
 // Recheck unfinished mapped games on the existing scoreboard refresh, without another timer.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[hasOfficial,data?.updatedAt]);
 const officialGames=[...new Map([...Object.values(archivedGames),...(data?.games||[])].map(g=>[g.id,g])).values()];
 const officialPicks=officialAdvancement(officialField,officialGames);
 const teams=field.teams.map(t=>({...t,logo:poll?.teams.find(p=>p.teamId===t.id)?.logo,record:displayRecord(t.id,data?.currentRecords)||poll?.teams.find(p=>p.teamId===t.id)?.record}));
 return <AppFrame compact title="The playoff picture." eyebrow="THE ROAD TO THE TWELVE"><PlayoffNavigation/><div className="playoffMode" role="group" aria-label="Bracket view">{(['projected','official','whatif'] as const).map(m=><button key={m} aria-pressed={m===mode} onClick={()=>setMode(m)}>{m==='whatif'?'What If':m==='official'?'Official':'Projected'}</button>)}{mode==='whatif'&&<button onClick={()=>setPicks({})}>Reset picks</button>}</div>{error&&<p role="status">{error}</p>}{mode==='official'?<>{hasOfficial?<><p className="playoffIntro">Official field · Published {officialField.publishedAt?.slice(0,10)}. Teams advance only from verified final scores and reconciled game identities.</p><ConnectedBracket teams={officialField.teams} picks={officialPicks}/><a href={officialField.sourceUrl!} target="_blank" rel="noopener noreferrer">Official CFP field ↗</a></>:<><p className="playoffIntro">The official 2026 field is scheduled for Selection Day, December 6. Published weekly rankings are not a seeded bracket. No official qualifiers or playoff winners are assumed.</p><ConnectedBracket teams={[]}/><a href="https://collegefootballplayoff.com/news/2026/11/2/cfp-sc-101" target="_blank" rel="noopener noreferrer">CFP selection timetable ↗</a></>}</>:<><p className="playoffIntro">{mode==='whatif'?'Tap a matchup to pick a winner. Reset clears your simulation.':'Poll-based illustration · conditional seeds, not the official field.'}</p><details className="bracketAssumptions"><summary>Projection assumptions & data limits</summary><p>Highest-ranked Power Four teams are hypothetical conference champions, plus the required six-conference representative. Eligibility is assumed. This is not a committee forecast.</p><p>{field.reason}</p></details><p className="snapshotLabel">{poll?`${poll.name} · ${poll.date?.slice(0,10)||'Date unavailable'}`:busy?'Loading published poll…':'A complete published poll is unavailable.'} · <a href={CFP_2026_PROTOCOL} target="_blank" rel="noopener noreferrer">Selection rules ↗</a></p>{field.status==='withheld'&&<p role="status">{field.reason}</p>}<ConnectedBracket key={mode} teams={teams} provisional picks={mode==='whatif'?picks:{}} onPick={mode==='whatif'?setPicks:undefined}/><Link className="routeLink" href="/scenarios">Change conference champions & regular-season outcomes →</Link></>}
 <section className="playoffTop12"><div className="sectionHeading"><h2>Official poll · Top 12</h2><Link href="/rankings">Full Top 25 →</Link></div><p className="snapshotLabel">{poll?.name||'Published poll unavailable'}{poll?.date?' · '+poll.date.slice(0,10):''} · Poll positions, separate from bracket seeds.</p><ol>{poll?.teams.slice(0,12).map(t=><li key={t.teamId}><b>#{t.rank}</b><Link href={'/team/'+t.teamId}>{t.name}</Link></li>)}</ol></section></AppFrame>;
}
