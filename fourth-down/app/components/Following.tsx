"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {CHANGED,readPreferences,saveFollowing,syncFollowing,cleanFinishedFollows} from '../lib/following-client';
import {confirmedFinal,type TemporaryFollow} from '../lib/alerts';
import FollowDialog from './FollowDialog';
import {displayRecord,type CurrentRecord} from '../lib/playoff/record-view';
import {matchesFollow,orderedWatchGames,watchClock,type WatchGame} from '../lib/watchlist';
export type {WatchGame} from '../lib/watchlist';
const RECENT='fourth-down-recent-watchlist-v1';
// Keep short-lived tombstones beyond display expiry so timed team follows cannot
// re-add an old final on every refresh. The feed-start bound is only 36 hours.
type Recent={game:WatchGame;observedAt:number};
function readRecent():Recent[]{try{const v=JSON.parse(localStorage.getItem(RECENT)||'[]');return Array.isArray(v)?v.filter(r=>r&&r.game&&confirmedFinal(r.game)&&Number.isFinite(r.observedAt)&&r.observedAt<=Date.now()&&Date.now()-r.observedAt<48*3600000).slice(-40):[];}catch{return [];}}
const emptySnapshot={items:[] as TemporaryFollow[],recent:[] as Recent[],ready:false};
let snapshot=emptySnapshot;
const subscribers=new Set<()=>void>();
let timer:ReturnType<typeof setInterval>|undefined;
function refreshFollowing(){snapshot={items:readPreferences().following?.items||[],recent:readRecent().filter(r=>Date.now()-r.observedAt<86400000).slice(-20),ready:true};for(const notify of subscribers)notify();}
function subscribeFollowing(notify:()=>void){
 subscribers.add(notify);
 if(subscribers.size===1){refreshFollowing();window.addEventListener(CHANGED,refreshFollowing);window.addEventListener('storage',refreshFollowing);timer=setInterval(refreshFollowing,30000);}
 return ()=>{subscribers.delete(notify);if(!subscribers.size){window.removeEventListener(CHANGED,refreshFollowing);window.removeEventListener('storage',refreshFollowing);clearInterval(timer);}};
}
function useFollowing(){return useSyncExternalStore(subscribeFollowing,()=>snapshot,()=>emptySnapshot);}

const finished=(g:WatchGame)=>confirmedFinal({...g,period:g.period??undefined,clock:g.clock??undefined});
export function FollowButton({kind,id,name,games}:{kind:'game'|'team';id:string;name:string;games:WatchGame[]}){
 const {items,ready}=useFollowing();const [open,setOpen]=useState(false),[message,setMessage]=useState('');
 const active=items.find(f=>f.kind===kind&&f.id===id&&f.expiresAt>Date.now()&&!games.some(g=>g.id===f.gameId&&finished(g)));
 const next=games.filter(g=>!finished(g)&&g.status!=='post'&&(kind==='game'?g.id===id:g.teams.some(t=>t.id===id))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
 const offered=useRef(false);useEffect(()=>{const query=new URLSearchParams(location.search),at=Number(query.get('alertAt')),until=Number(query.get('inviteUntil'));if(ready&&!offered.current&&kind==='game'&&query.get('follow')==='1'&&next&&!active&&Number.isFinite(at)&&at>0&&(!query.has('inviteUntil')||(Number.isFinite(until)&&until>Date.now()))&&at<=Date.now()&&Date.now()-at<900000){offered.current=true;setOpen(true);}},[ready,kind,next,active]);
 return <div className="followControl"><button disabled={!ready||(!active&&kind==='game'&&!next)} aria-haspopup="dialog" onClick={()=>setOpen(true)}>{active?'Manage Follow':kind==='game'?'Follow Game':'Follow Team'}</button>{open&&<FollowDialog kind={kind} id={id} name={name} next={next} existing={active} onClose={()=>setOpen(false)} onSaved={setMessage}/>}<p role="status">{message}</p></div>;
}

export default function Following({games,manage=false,currentRecords}:{games:WatchGame[];manage?:boolean;currentRecords?:Record<string,CurrentRecord>}){
 useEffect(()=>{if(manage)return;try{const p=readPreferences(),recent=readRecent();for(const game of games.filter(g=>finished(g)&&Date.parse(g.date)<=Date.now()&&Date.now()-Date.parse(g.date)<36*3600000)){if(p.following?.items.some(f=>f.expiresAt>Date.now()&&matchesFollow(f,game))&&!recent.some(r=>r.game.id===game.id))recent.push({game,observedAt:Date.now()});}localStorage.setItem(RECENT,JSON.stringify(recent.slice(-40)));cleanFinishedFollows(games.filter(finished).map(g=>g.id));refreshFollowing();}catch{}},[games,manage]);
 useEffect(()=>{if(manage)return;const retry=()=>{try{if(localStorage.getItem('fourth-down-following-pending')==='true')void syncFollowing().catch(()=>{});}catch{}};window.addEventListener('online',retry);window.addEventListener('focus',retry);return()=>{window.removeEventListener('online',retry);window.removeEventListener('focus',retry);};},[manage]);
 const {items,recent,ready}=useFollowing();const [message,setMessage]=useState('');const now=Date.now();
 const active=items.filter(f=>f.expiresAt>now&&!games.some(g=>g.id===f.gameId&&finished(g)));
 const watched=orderedWatchGames(games,active,now).filter(g=>!finished(g));
 async function remove(f:TemporaryFollow){try{setMessage(await saveFollowing((readPreferences().following?.items||[]).filter(x=>x.kind!==f.kind||x.id!==f.id)));}catch(e){setMessage(e instanceof Error?e.message:'Could not update following.');}}
 return <section id={manage?'following':'watchlist'} className="followingPanel" aria-labelledby={manage?'following-heading':'watchlist-heading'}><h2 id={manage?'following-heading':'watchlist-heading'}>{manage?'Following':'My Watchlist'}</h2><p>Temporary follows only. Your permanent favorites stay unchanged.</p>{!ready&&<p>Loading your follows…</p>}{ready&&!active.length&&<div className="watchEmpty"><p>No active follows yet. Choose a game or team to start your Watchlist.</p><a href="#scores">Browse games →</a></div>}{manage?<><a href="#alerts">Manage optional following notifications</a>{active.map(f=><article className="detailCard" key={f.kind+f.id}><a href={`/${f.kind}/${f.id}`}>{f.name}</a><p>{f.duration==='game'?'One game':`Until ${new Date(f.expiresAt).toLocaleString()}`}</p><FollowButton kind={f.kind} id={f.id} name={f.name} games={games}/><button onClick={()=>remove(f)}>Unfollow {f.name}</button></article>)}</>:<>{watched.map(g=><article className="detailCard" key={g.id}><h3><a href={`/game/${g.id}`}>{g.name}</a></h3><p>{g.status==='in'?'LIVE · ':''}{g.detail||g.status}{watchClock(g)&&` · ${watchClock(g)}`}</p><p>{g.kickoffTbd?`${new Date(g.date).toLocaleDateString()} · Kickoff time TBD`:new Date(g.date).toLocaleString(undefined,{timeZoneName:'short'})}</p>{g.teams.map(t=><p key={t.id}><a href={`/team/${t.id}`}>{t.name}</a>{displayRecord(t.id,currentRecords)&&` · ${displayRecord(t.id,currentRecords)}`} <strong>{g.status==='pre'?'—':t.score??'—'}</strong></p>)}{active.filter(f=>matchesFollow(f,g)).map(f=><div className="watchActions" key={f.kind+f.id}><span>{f.kind==='team'?'Team follow':'Game follow'} · {f.name}</span><FollowButton kind={f.kind} id={f.id} name={f.name} games={games}/><button onClick={()=>remove(f)}>Unfollow {f.name}</button></div>)}</article>)}{!!active.length&&!watched.length&&<p>No games in the current feed for your follows. Your team follows remain saved until they expire.</p>}{!!active.filter(f=>!watched.some(g=>matchesFollow(f,g))).length&&<div><h3>Other temporary follows</h3>{active.filter(f=>!watched.some(g=>matchesFollow(f,g))).map(f=><article className="detailCard" key={f.kind+f.id}><a href={`/${f.kind}/${f.id}`}>{f.name}</a><FollowButton kind={f.kind} id={f.id} name={f.name} games={games}/><button onClick={()=>remove(f)}>Unfollow {f.name}</button></article>)}</div>}{!!recent.length&&<section className="recentWatchlist" aria-label="Recently completed games"><h3>Recently completed</h3><p>Results stay here for 24 hours after first seen as final. Completed one-game alerts have ended.</p>{recent.slice().reverse().map(({game:savedGame})=>{const g=games.find(g=>g.id===savedGame.id&&finished(g))||savedGame;return <article className="detailCard" key={g.id}><h4><a href={`/game/${g.id}`}>{g.name}</a></h4><p>{g.detail||'Final'}</p>{g.teams.map(t=><p key={t.id}><a href={`/team/${t.id}`}>{t.name}</a>{displayRecord(t.id,currentRecords)&&` · ${displayRecord(t.id,currentRecords)}`} <strong>{t.score}</strong></p>)}</article>;})}</section>}<a href="#following">Manage all temporary follows →</a></>}{items.length>active.length&&<p>Completed games and expired follows have been removed from this list.</p>}<button onClick={async()=>{try{setMessage(await syncFollowing());}catch(e){setMessage(e instanceof Error?e.message:'Could not update delivery.');}}}>Retry saving alerts</button><p role="status">{message}</p></section>;
}
