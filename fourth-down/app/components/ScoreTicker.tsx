'use client';
import Link from 'next/link';
import type {Feed} from '../lib/tracker-types';
import {watchClock} from '../lib/watchlist';
export default function ScoreTicker({feed,busy}:{feed:Feed|null;busy:boolean}){
 const priority=(status:string)=>status==='in'?0:status==='pre'?1:2;
 const games=(feed?.games||[]).filter(g=>g.teams.length===2&&g.teams.every(t=>t.name&&!/^TBD$/i.test(t.name))).slice().sort((a,b)=>priority(a.status)-priority(b.status)||(a.status==='post'?Date.parse(b.date)-Date.parse(a.date):Date.parse(a.date)-Date.parse(b.date))).slice(0,16);
 return <section className="scoreTicker" aria-label="Scoreboard ticker"><div className="tickerLabel"><span className="liveDot"/> SCOREBOARD<small>{busy?'Updating':games.some(g=>g.status==='in')?'Live now':'Around the FBS'}</small></div><div className="tickerRail" tabIndex={0} role="region" aria-label="Scroll game scores">{games.map(g=><Link prefetch={false} href={'/game/'+g.id} key={g.id} className="tickerGame"><small className={g.status==='in'?'liveText':''}>{g.status==='in'?'LIVE · '+(watchClock(g)||g.detail):g.status==='post'?g.detail:g.kickoffTbd?'Kickoff TBD':new Date(g.date).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'})}</small>{g.teams.map(t=><span key={t.id}>{t.logo&&<img src={t.logo} width="18" height="18" alt="" loading="lazy"/>}<b>{t.name}</b><strong>{g.status==='in'||g.completed?t.score??'—':'—'}</strong></span>)}</Link>)}{!games.length&&<p className="tickerEmpty">{busy?'Connecting to the scoreboard…':'Scoreboard unavailable. Browse games to retry.'}</p>}</div></section>;
}
