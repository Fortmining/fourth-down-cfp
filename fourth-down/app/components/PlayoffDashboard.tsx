'use client';
import {useState} from 'react';
import Link from 'next/link';
import AppFrame from './AppFrame';
import PlayoffNavigation from './PlayoffNavigation';
import ConnectedBracket from './ConnectedBracket';
import {useLiveFeed} from './useTrackerData';
import {conferenceLabel,referenceField,CFP_2026_PROTOCOL} from '../lib/playoff-outlook';
import {pulseTeams} from '../lib/pulse-teams';
import type {BracketPicks} from '../lib/bracket-predictor';
import {displayRecord} from '../lib/playoff/record-view';
export default function PlayoffDashboard(){
 const {data,busy,error}=useLiveFeed();const [mode,setMode]=useState<'projected'|'official'|'whatif'>('projected'),[picks,setPicks]=useState<BracketPicks>({});
 const poll=data?.polls.find(p=>p.id==='cfp'&&p.teams.length===25)??data?.polls.find(p=>p.id===data.defaultRankingSource&&p.teams.length===25);
 const conferences=Object.fromEntries(pulseTeams.map(t=>[t.id,conferenceLabel(t.conference)]));
 const champions=Object.fromEntries(['ACC','Big Ten','Big 12','SEC'].map(c=>[c,[...(poll?.teams||[])].sort((a,b)=>a.rank-b.rank).find(t=>conferences[t.teamId]===c)?.teamId||'']));
 const field=referenceField(poll,conferences,{champions,eligibilityAssumed:true,reserveUnknownRepresentative:true});
 const teams=field.teams.map(t=>({...t,logo:poll?.teams.find(p=>p.teamId===t.id)?.logo,record:displayRecord(t.id,data?.currentRecords)||poll?.teams.find(p=>p.teamId===t.id)?.record}));
 return <AppFrame compact title="The playoff picture." eyebrow="THE ROAD TO THE TWELVE" description="Two paths. Twelve teams. One champion."><PlayoffNavigation/><div className="playoffMode" role="group" aria-label="Bracket view">{(['projected','official','whatif'] as const).map(m=><button key={m} aria-pressed={m===mode} onClick={()=>setMode(m)}>{m==='whatif'?'What If':m==='official'?'Official':'Projected'}</button>)}{mode==='whatif'&&<button onClick={()=>setPicks({})}>Reset picks</button>}</div>{error&&<p role="status">{error}</p>}{mode==='official'?<><p className="playoffIntro">The official 2026 field is scheduled for Selection Day, December 6. Published weekly rankings are not a seeded bracket. No official qualifiers or playoff winners are assumed.</p><ConnectedBracket teams={[]}/><a href="https://collegefootballplayoff.com/news/2026/11/2/cfp-sc-101" target="_blank" rel="noopener noreferrer">CFP selection timetable ↗</a></>:<><p className="playoffIntro">{mode==='whatif'?'Choose a matchup, advance a winner, and follow your path to the title. Reset clears your picks. This simulation stays separate from official results.':'Poll-based projection using the highest-ranked Power Four teams as hypothetical conference champions, plus the required six-conference representative. Eligibility is assumed. This is a conditional layout, not a committee forecast.'}</p><p className="snapshotLabel">{poll?`${poll.name} · ${poll.date?.slice(0,10)||'Date unavailable'}`:busy?'Loading published poll…':'A complete published poll is unavailable.'} · <a href={CFP_2026_PROTOCOL} target="_blank" rel="noopener noreferrer">Selection rules ↗</a></p>{field.status==='withheld'&&<p role="status">{field.reason}</p>}{field.status!=='withheld'&&<p className="snapshotLabel">{field.reason}</p>}<ConnectedBracket key={mode} teams={teams} provisional picks={mode==='whatif'?picks:{}} onPick={mode==='whatif'?setPicks:undefined}/><Link className="routeLink" href="/scenarios">Change conference champions & regular-season outcomes →</Link></>}
 <section className="playoffTop12"><div className="sectionHeading"><h2>Official poll · Top 12</h2><Link href="/rankings">Full Top 25 →</Link></div><p className="snapshotLabel">{poll?.name||'Published poll unavailable'}{poll?.date?' · '+poll.date.slice(0,10):''} · Poll positions, separate from bracket seeds.</p><ol>{poll?.teams.slice(0,12).map(t=><li key={t.teamId}><b>#{t.rank}</b><Link href={'/team/'+t.teamId}>{t.name}</Link></li>)}</ol></section></AppFrame>;
}
