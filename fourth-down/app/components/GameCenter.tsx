"use client";
import { useEffect, useState } from 'react';
import { subscribeLiveRefresh } from '../lib/live-refresh';
import type { GameCenterData, FieldPlay, FieldBranding } from '../lib/game-center';
import './game-center.css';
import {fieldX,fieldMotionPath} from '../lib/gamecast-field';
type HeaderGame = {
    status: string;
    detail: string;
    date: string;
    kickoffTbd?: boolean;
    teams: {
        id: string;
        name: string;
        logo?: string | null;
        score?: string;
        homeAway?: string;
    }[];
};
const tabs = ['Plays', 'Drives', 'Team Stats', 'Players'] as const;
export default function GameCenter({ id, fallbackGame }: {
    id: string;
    fallbackGame?: HeaderGame;
}) {
    const [data, setData] = useState<GameCenterData | null>(null), [game, setGame] = useState<HeaderGame | null>(null), [error, setError] = useState(''), [selected, setSelected] = useState<string | null>(null), [observedAt, setObservedAt] = useState<string | null>(null), [tab, setTab] = useState<number>(0);
    useEffect(() => { const controller = new AbortController(); let running = false, completed = false; async function refresh() { if (running)
        return; running = true; try {
        const r = await fetch(`/api/games/${encodeURIComponent(id)}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        if (!r.ok)
            throw Error();
        const body = await r.json();
        if (body.game?.id !== id || !body.center || !Array.isArray(body.center.drives) || !Array.isArray(body.center.teams) || !Array.isArray(body.center.teamStats) || !Array.isArray(body.center.playerStats))
            throw Error();
        if (controller.signal.aborted)
            return;
        completed = body.game.status === 'post';
        setData(body.center);
        setGame(body.game);
        setObservedAt(Number.isFinite(Date.parse(body.observedAt)) ? body.observedAt : null);
        setError('');
    }
    catch {
        if (!controller.signal.aborted)
            setError('Play details could not refresh. Any earlier plays remain visible.');
    }
    finally {
        running = false;
    } } void refresh(); const stop = subscribeLiveRefresh(refresh,document,window,{intervalMs:15000,enabled:()=>!completed}); return () => { controller.abort(); stop(); }; }, [id]);
    const source = game || fallbackGame;
    const teams = [...(source?.teams || data?.teams || [])].sort((a, b) => ('homeAway' in a && a.homeAway === 'away' ? -1 : 'homeAway' in a && a.homeAway === 'home' ? 1 : 0) - ('homeAway' in b && b.homeAway === 'away' ? -1 : 'homeAway' in b && b.homeAway === 'home' ? 1 : 0));
    const plays = data?.drives.flatMap(d => d.plays) || [];
    const play = plays.find(p => p.id === selected) || plays.filter(p => p.animation || p.trace || p.kickResult).at(-1);
    const branding = data?.branding || { kind: 'unknown', teamName: null, logo: null, color: null } as FieldBranding;

    const replay = Boolean(selected);
    const replaySpot=play?.endPosition!==null&&play?.endPosition!==undefined?{teamId:play.endTeamId||play.teamId,yardsToEndzone:play.endPosition}:play?.trace&&play.end!==null?{teamId:play.teamId,yardsToEndzone:play.end}:null;
    const spot=replay||source?.status==='post'?replaySpot:data?.ballPosition||null;
    const markerTeam=data?.teams.find(t=>t.id===spot?.teamId);
    const marker=spot?.teamId?{...spot,teamId:spot.teamId,logo:markerTeam?.logo||null,name:markerTeam?.name||'Possession',firstDown:!replay&&source?.status==='in'?data?.ballPosition?.firstDown??null:null,label:replay||source?.status==='post'?'Replay possession':'Possession'}:null;
    const drive=!replay?data?.currentDrive:null;
    return <section className="gameCenter gcCast" aria-label="Gamecast">
    <h2 className="gcSrOnly">Gamecast</h2>
    <div className="gcBroadcast">
    <div className="gcKicker">
    <span>{data?.venue || 'GAMECAST'}{data?.neutral === true ? ' · NEUTRAL SITE' : ''}</span>
    <details className="gcInfo">
    <summary aria-label="About this field and game data">ⓘ</summary>
    <div>
    <strong>About this Gamecast</strong>
    <p>Schematic field with verified home-team branding where available, not actual stadium artwork. Spots are relative to the offense. Ground tracers connect reported spots. Aerial arcs are illustrative, never tracked flight: pass endpoints include the full play, kicks use reported kick distance, and successful scoring kicks target the goal plane. Returns and touchbacks are separate post-play spots. The field keeps a fixed team orientation.</p>
    <p>{data?.situation?.basis === 'last-play' ? 'Situation is from the last reported play.' : 'ESPN data may be delayed or corrected.'} Checks every 15 seconds during live games while visible, and when you return.</p>
    <p>{observedAt ? `Checked ${new Date(observedAt).toLocaleTimeString(undefined, { timeZoneName: 'short' })}` : 'Check time unavailable'}</p>
    <a href={`https://www.espn.com/college-football/game/_/gameId/${id}`}>ESPN game coverage ↗</a>
    </div>
    </details>
    </div>
    <div className="gcScoreboard">{teams.map((t, i) => <div className={`gcTeam gcTeam${i}`} key={t.id}>
        <a href={`/team/${t.id}`}>{t.logo && /^https:\/\/(?:[a-z0-9-]+\.)*espncdn\.com\//i.test(t.logo) ? <img src={t.logo} width="56" height="56" alt=""/> : <span className="gcMonogram">{t.name.slice(0, 2)}</span>}<span>
        <small>{'homeAway' in t ? t.homeAway || 'TEAM' : 'TEAM'}</small>
        <b>{t.name}</b>{data?.situation?.possessionTeamId === t.id && <em>● Possession</em>}</span>
        </a>
        <strong>{source?.status === 'pre' ? '—' : t.score ?? '—'}</strong>
        </div>)}<div className="gcClock">
    <span>{source?.status === 'post' ? 'FINAL' : source?.status === 'pre' ? 'UPCOMING' : 'LIVE'}</span>
    <b>{source?.status === 'pre' ? (source.kickoffTbd ? 'Time TBD' : new Date(source.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) : source?.status === 'post' ? 'Game complete' : source?.detail || 'Status unavailable'}</b>
    </div>
    </div>
    <div className="gcSituation">{data?.situation?.downDistance || (source?.status === 'post' ? 'Full time' : source?.status === 'pre' ? 'Kickoff ahead' : play?.kickResult ? `Kick ${play.kickResult.toLowerCase()} · awaiting next possession` : 'Waiting for the next update')}{data?.situation?.basis === 'last-play' && <small>Last reported play</small>}</div>
    </div>{error && <p className="gcNotice" role="status">{error}</p>}<div className="gcFieldStage">
    <div className="gcFieldPlane">
    <Field key={selected || 'latest'} play={play} branding={branding} marker={marker} referenceTeamId={data?.homeTeamId||data?.teams[0]?.id||null}/>
    </div>
    <div className="gcFieldLegend">
    <span>
    <i />First down</span>
    <span>
    <i />Line of scrimmage</span>
    <b>{branding.kind === 'home' ? branding.teamName : branding.kind === 'neutral' ? 'Neutral field' : 'Fourth Down'}</b>
    </div>
    </div>
    <div className="gcSelected"><div className="gcDriveCard"><div><span>{replay?'SELECTED PLAY':drive?'CURRENT DRIVE':source?.status==='post'?'GAME COMPLETE':play?.kickResult&&!data?.situation?'AFTER THE KICK':'DRIVE UPDATE'}</span><b>{replay?play?.downDistance||'Reported play':data?.situation?.downDistance||(play?.kickResult?'Awaiting next possession':'Down & distance unavailable')}</b></div>{drive?<div className="gcDriveNumbers">{drive.plays!==null&&<span><b>{drive.plays}</b> plays</span>}{drive.yards!==null&&<span><b>{drive.yards}</b> yards</span>}{drive.elapsed&&<span><b>{drive.elapsed}</b> elapsed</span>}</div>:null}{drive?.description&&<p>{drive.description}</p>}</div>
    <div className="gcPlayMeta">
    <span>{selected ? 'REPLAY' : 'PREVIOUS PLAY'}{play ? ` · Q${play.period ?? '—'} ${play.clock}` : ''}</span>{selected && <button onClick={() => setSelected(null)}>Latest play</button>}</div>{play ? <>
        <div className="gcPlayHeadline">
        <Yardage play={play}/>
        <b>{play.kickResult ? `Before kick · ${play.downDistance || 'Down unavailable'}` : play.downDistance || 'Reported play'}</b>
        </div>
        <p>{play.text}</p>{play.kickResult&&!play.animation&&<small className="gcIllustration">Kick {play.kickResult.toLowerCase()} · flight path unavailable</small>}{play.animation&&play.animation.kind!=='rush'&&play.animation.kind!=='ground'&&<small className="gcIllustration">Illustrative {play.animation.kind.replaceAll('-',' ')} path{play.animation.result?` · ${play.animation.result}`:''}</small>}{!play.trace && !play.animation && <small>Verified position data unavailable for this play.</small>}</> : <p>{data ? 'Play positions will appear when verified spots are available.' : 'Loading game details…'}</p>}</div>
    <div className="gcTabs" role="tablist" aria-label="Game details">{tabs.map((t, i) => <button key={t} id={`gc-tab-${i}`} role="tab" aria-selected={tab === i} aria-controls="gc-panel" tabIndex={tab === i ? 0 : -1} onClick={() => setTab(i)} onKeyDown={e => { let next = tab; if (e.key === 'ArrowRight')
            next = (tab + 1) % 4;
        else if (e.key === 'ArrowLeft')
            next = (tab + 3) % 4;
        else if (e.key === 'Home')
            next = 0;
        else if (e.key === 'End')
            next = 3;
        else
            return; e.preventDefault(); setTab(next); document.getElementById(`gc-tab-${next}`)?.focus(); }}>{t}</button>)}</div>
    <div id="gc-panel" className="gcPanel" role="tabpanel" aria-labelledby={`gc-tab-${tab}`}>
 {tab === 0 && (plays.length ? <ol className="gcPlays">{plays.slice().reverse().map(p => <li key={p.id}>
            <button onClick={() => setSelected(p.id)} aria-pressed={play?.id === p.id}>
            <span className="gcPlayTime">Q{p.period ?? '—'}<b>{p.clock}</b>
            </span>
            <span>{play?.id === p.id ? <>
                <b>{selected ? 'Selected play' : 'Previous play'}</b>
                <small>{p.downDistance || 'Selected play'}</small>
                </> : p.text}</span>
            <Yardage play={p}/>
            </button>
            </li>)}</ol> : <Empty text="Play-by-play will appear when the source provides it."/>)}
 {tab === 1 && (data?.drives.length ? <div className="gcDrives">{data.drives.slice().reverse().map(d => <article key={d.id}>
            <header>
            <b>{d.team}</b>
            <span>{d.result || 'In progress'}</span>
            </header>
            <p>{d.description || 'Drive details unavailable'}</p>
            <button onClick={() => { setSelected(d.plays.at(-1)?.id || null); setTab(0); }}>View plays <span>→</span>
            </button>
            </article>)}</div> : <Empty text="Drive history is not available yet."/>)}
 {tab === 2 && (data?.teamStats.length ? <div className="gcTeamStats">{data.teamStats.map(t => <section key={t.teamId}>
            <h3>
            <a href={`/team/${t.teamId}`}>{t.name}</a>
            </h3>
            <dl>{t.stats.map(s => <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
                </div>)}</dl>
            </section>)}</div> : <Empty text="Team statistics are not available yet."/>)}
 {tab === 3 && (data?.playerStats.length ? data.playerStats.map(t => <section className="gcPlayerTeam" key={t.teamId}>
        <h3>{data.teams.find(team => team.id === t.teamId)?.name || 'Team'}</h3>{t.groups.map(g => <div key={g.name} className="statScroll" tabIndex={0} role="region" aria-label={`${g.name} player statistics`}>
            <table>
            <caption>{g.name}</caption>
            <thead>
            <tr>
            <th scope="col">Player</th>{g.labels.map(l => <th scope="col" key={l}>{l}</th>)}</tr>
            </thead>
            <tbody>{g.players.map(p => <tr key={p.name}>
                <th scope="row">{p.name}</th>{p.values.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
            </table>
            </div>)}</section>) : <Empty text="Player statistics are not available yet."/>)}
 </div>
    </section>;
}
function Empty({ text }: {
    text: string;
}) { return <p className="gcEmpty">{text}</p>; }
type FieldMarker={teamId:string;yardsToEndzone:number;logo:string|null;name:string;firstDown:number|null;label:string};
function Field({ play, branding,marker,referenceTeamId }: {
    play?: FieldPlay;
    branding: FieldBranding;
    marker:FieldMarker|null;referenceTeamId:string|null;
}) {
    const x = (n: number,teamId=play?.teamId) => fieldX(n,teamId,referenceTeamId);
    const trace = play?.trace && play.start !== null && play.end !== null;
    const gain = (play?.yards || 0) >= 0;
    const motion=play?.animation||(play?.animation===undefined&&trace&&play?{from:play.start!,to:play.end!,teamId:play.teamId!,kind:'ground'}:null);
    const aerial=motion&&motion.kind!=='rush'&&motion.kind!=='ground';
    const path=motion?fieldMotionPath(motion,referenceTeamId):'';
    const restingX=marker?x(marker.yardsToEndzone,marker.teamId):null;
    const lineX=marker?.label==='Possession'?restingX:play?.start!==null&&play?.start!==undefined?x(play.start):null;
    const targetX=marker?.firstDown!==null&&marker?.firstDown!==undefined?x(marker.firstDown,marker.teamId):play?.firstDown!==null&&play?.firstDown!==undefined?x(play.firstDown):null;
    return <svg viewBox="-5 -4 130 62" role="img" aria-label={play ? `Schematic field positions for selected play. ${play.animation ? 'Illustrative play path, not tracked ball flight.' : play.trace ? 'Reported start and end spots.' : 'Position data unavailable.'}` : 'Football field. Awaiting verified play positions.'}>
    <defs>
    <linearGradient id="gcTurf" x2="0" y2="1">
    <stop stopColor="#237c4e"/>
    <stop offset="1" stopColor="#12462f"/>
    </linearGradient>
    <filter id="gcBallShadow">
    <feDropShadow dx="0" dy=".6" stdDeviation=".7" floodOpacity=".65"/>
    </filter>
    </defs>
    <rect width="120" height="54" rx="1" fill="url(#gcTurf)"/>{Array.from({ length: 10 }, (_, i) => <rect key={i} x={10 + i * 10} width="10" height="54" fill={i % 2 ? '#fff' : '#000'} opacity=".045"/>)}<rect width="10" height="54" fill={branding.color || '#152b40'}/>
    <rect x="110" width="10" height="54" fill={branding.color || '#152b40'}/>
    <text transform="translate(6 27) rotate(-90)" textAnchor="middle" fill="white" fontSize="3" fontWeight="900">FOURTH DOWN</text>
    <text transform="translate(114 27) rotate(90)" textAnchor="middle" fill="white" fontSize="3" fontWeight="900">{branding.kind === 'home' ? 'HOME FIELD' : 'GAME DAY'}</text>
    <g stroke="#fff" strokeWidth=".25" opacity=".8">{Array.from({ length: 11 }, (_, i) => <line key={i} x1={10 + i * 10} x2={10 + i * 10} y1="0" y2="54"/>)}{Array.from({ length: 101 }, (_, i) => <g key={i}>{[1, 22, 31, 52].map(y => <line key={y} x1={10 + i} x2={10 + i} y1={y} y2={y + 1}/>)}</g>)}</g>{[10, 20, 30, 40, 50, 40, 30, 20, 10].map((n, i) => <g key={i} fill="#fff" opacity=".8" fontSize="3" fontWeight="700">
        <text x={20 + i * 10} y="9" textAnchor="middle">{n}</text>
        <text x={20 + i * 10} y="47" textAnchor="middle" transform={`rotate(180 ${20 + i * 10} 46)`}>{n}</text>
        </g>)}{branding.logo ? <image href={branding.logo} x="53" y="20" width="14" height="14" opacity=".65"/> : <text x="60" y="29" textAnchor="middle" fontSize="4" fontWeight="900" fill="white" opacity=".35">4TH DOWN</text>}{lineX!==null&&<line className="gcScrimmage" x1={lineX} x2={lineX} y1="0" y2="54" stroke="#67c8ff" strokeWidth=".65"/>}{targetX!==null&&<line className="gcFirstDown" x1={targetX} x2={targetX} y1="0" y2="54" stroke="#ffdb4c" strokeWidth=".8"/>}{[0,120].map(goalX => <g key={goalX} className="gcGoalpost" aria-hidden="true"
      data-goal-x={goalX} stroke="#ffdc57" strokeWidth=".65" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <ellipse cx={goalX} cy="27" rx="1" ry=".45" fill="#102a20" stroke="none"/>
      <path className="gcGoalSupport" d={`M ${goalX} 27 V 20`}/>
      <path className="gcGoalUprights" d={`M ${goalX-2.82} 10 V 20 H ${goalX+2.82} V 10`}/>
    </g>)}
    {motion&&play&&<g key={`motion-${play.id}`}><path className={`gcTracer ${aerial?'gcAerialTracer':''}`} pathLength="1" d={path} stroke={aerial?'#a8e8ff':gain?'#b6ff6b':'#ff927f'} strokeWidth={aerial?'1':'2'} strokeLinecap="round" fill="none"/>
    <circle cx={x(motion.from,motion.teamId)} cy="27" r=".8" fill="white"/>{['field-goal','extra-point'].includes(motion.kind)&&<circle className="gcGoalTarget" cx={x(motion.to,motion.teamId)} cy="15" r=".9" fill="#ffdc57"/>}
    <g className="gcBall" filter="url(#gcBallShadow)"><animateMotion ref={beginPlayAnimation} begin="indefinite" path={path} dur="1.15s" fill="freeze"/><Football/></g></g>}
    {restingX!==null&&<g key={`rest-${play?.id||'spot'}`} className="gcStaticBall gcRestBall" style={{transform:`translate(${restingX}px,27px)`}}><Football/></g>}
    {marker&&restingX!==null&&<g className="gcPossessionMarker" style={{transform:`translate(${restingX}px,27px)`}} role="img" aria-label={`${marker.label}: ${marker.name}, ${marker.yardsToEndzone} yards to opponent goal`}>
    <path d="M -3.4 -12 H 3.4 V -5 L 0 -2.8 L -3.4 -5 Z" fill="#fff" stroke="#edb82e" strokeWidth=".5"/>
    {marker.logo?<image href={marker.logo} x="-2.7" y="-11.4" width="5.4" height="5.4"/>:<text x="0" y="-7.5" fontSize="2.2" textAnchor="middle" fill="#14243b">{marker.name.slice(0,2).toUpperCase()}</text>}
    </g>}</svg>;
}
function beginPlayAnimation(animation:SVGElement|null){if(animation)(animation as SVGAnimationElement).beginElement();}
function Football(){return <><ellipse rx="3" ry="1.8" fill="#a95126" stroke="#fff0d6" strokeWidth=".4"/><path d="M -1.2 0 H 1.2 M -.7 -.6 V .6 M 0 -.6 V .6 M .7 -.6 V .6" stroke="white" strokeWidth=".25"/></>;}

function Yardage({play}:{play:FieldPlay}){const a=play.animation,kick=!!play.kickResult||!!a&&['punt','kickoff','field-goal','extra-point'].includes(a.kind),distance=a&&(a.kind==='punt'||a.kind==='kickoff')?a.from-a.to:play.yards;return <strong className={distance!==null&&distance<0?'gcLoss':''}>{distance===null?a?.result?.toUpperCase()||'—':`${!kick&&distance>0?'+':''}${distance}`}<small>{distance===null&&a?.result?'RESULT':kick?'KICK YDS':'YDS'}</small></strong>;}
