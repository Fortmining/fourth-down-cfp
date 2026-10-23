"use client";
import {useEffect,useState,useSyncExternalStore} from 'react';
import {CHANGED,readPreferences,saveFollowing,syncFollowing,cleanFinishedFollows} from '../lib/following-client';
import {confirmedFinal,type TemporaryFollow} from '../lib/alerts';
import FollowDialog from './FollowDialog';
export type WatchGame={id:string;name:string;date:string;status:string;detail?:string;kickoffTbd?:boolean;completed?:boolean;providerStatus?:string;teams:{id:string;name:string;score?:string}[]};
const emptySnapshot={items:[] as TemporaryFollow[],ready:false};
let snapshot=emptySnapshot;
const subscribers=new Set<()=>void>();
let timer:ReturnType<typeof setInterval>|undefined;
function refreshFollowing(){snapshot={items:readPreferences().following?.items||[],ready:true};for(const notify of subscribers)notify();}
function subscribeFollowing(notify:()=>void){
 subscribers.add(notify);
 if(subscribers.size===1){refreshFollowing();window.addEventListener(CHANGED,refreshFollowing);window.addEventListener('storage',refreshFollowing);timer=setInterval(refreshFollowing,30000);}
 return ()=>{subscribers.delete(notify);if(!subscribers.size){window.removeEventListener(CHANGED,refreshFollowing);window.removeEventListener('storage',refreshFollowing);clearInterval(timer);}};
}
function useFollowing(){return useSyncExternalStore(subscribeFollowing,()=>snapshot,()=>emptySnapshot);}

const finished=(g:WatchGame)=>confirmedFinal(g);
export function FollowButton({kind,id,name,games}:{kind:'game'|'team';id:string;name:string;games:WatchGame[]}){
 const {items,ready}=useFollowing();const [open,setOpen]=useState(false),[message,setMessage]=useState('');
 const active=items.find(f=>f.kind===kind&&f.id===id&&f.expiresAt>Date.now()&&!games.some(g=>g.id===f.gameId&&finished(g)));
 const next=games.filter(g=>!finished(g)&&g.status!=='post'&&(kind==='game'?g.id===id:g.teams.some(t=>t.id===id))).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
 return <div className="followControl"><button disabled={!ready||(!active&&kind==='game'&&!next)} aria-haspopup="dialog" onClick={()=>setOpen(true)}>{active?'Manage Follow':kind==='game'?'Follow Game':'Follow Team'}</button>{open&&<FollowDialog kind={kind} id={id} name={name} next={next} existing={active} onClose={()=>setOpen(false)} onSaved={setMessage}/>}<p role="status">{message}</p></div>;
}

export default function Following({games,manage=false}:{games:WatchGame[];manage?:boolean}){
 useEffect(()=>{try{cleanFinishedFollows(games.filter(finished).map(g=>g.id));}catch{}},[games]);
 useEffect(()=>{if(manage)return;const retry=()=>{try{if(localStorage.getItem('fourth-down-following-pending')==='true')void syncFollowing().catch(()=>{});}catch{}};window.addEventListener('online',retry);window.addEventListener('focus',retry);return()=>{window.removeEventListener('online',retry);window.removeEventListener('focus',retry);};},[manage]);
 const {items,ready}=useFollowing();const [message,setMessage]=useState('');const now=Date.now();
 const active=items.filter(f=>f.expiresAt>now&&!games.some(g=>g.id===f.gameId&&finished(g)));
 const watched=games.filter(g=>active.some(f=>f.duration==='game'?f.gameId===g.id:f.kind==='team'&&g.teams.some(t=>t.id===f.id))&&!finished(g)).sort((a,b)=>Number(b.status==='in')-Number(a.status==='in')||Date.parse(a.date)-Date.parse(b.date));
 async function remove(f:TemporaryFollow){try{setMessage(await saveFollowing((readPreferences().following?.items||[]).filter(x=>x.kind!==f.kind||x.id!==f.id)));}catch(e){setMessage(e instanceof Error?e.message:'Could not update following.');}}
 return <section id={manage?'following':'watchlist'} className="followingPanel" aria-labelledby={manage?'following-heading':'watchlist-heading'}><h2 id={manage?'following-heading':'watchlist-heading'}>{manage?'Following':'My Watchlist'}</h2><p>Temporary follows keep your favorites unchanged. Game and one-game team follows end at the confirmed final. Timed team follows last 24 hours or 7 days.</p>{!ready&&<p>Loading your follows…</p>}{ready&&!active.length&&<p>No active follows. Follow a game from Games or follow a team from its team page.</p>}{manage?<><a href="#alerts">Manage optional following notifications</a>{active.map(f=><article className="detailCard" key={f.kind+f.id}><a href={`/${f.kind}/${f.id}`}>{f.name}</a><p>{f.duration==='game'?'One game':`Until ${new Date(f.expiresAt).toLocaleString()}`}</p><FollowButton kind={f.kind} id={f.id} name={f.name} games={games}/><button onClick={()=>remove(f)}>Unfollow {f.name}</button></article>)}</>:<>{watched.map(g=><article className="detailCard" key={g.id}><h3><a href={`/game/${g.id}`}>{g.name}</a></h3><p>{g.status==='in'?'LIVE · ':''}{g.detail||g.status}</p><p>{g.kickoffTbd?`${new Date(g.date).toLocaleDateString()} · Kickoff time TBD`:new Date(g.date).toLocaleString(undefined,{timeZoneName:'short'})}</p>{g.teams.map(t=><p key={t.id}><a href={`/team/${t.id}`}>{t.name}</a> <strong>{g.status==='pre'?'—':t.score??'—'}</strong></p>)}{active.filter(f=>f.duration==='game'?f.gameId===g.id:g.teams.some(t=>t.id===f.id)).map(f=><button key={f.kind+f.id} onClick={()=>remove(f)}>Unfollow {f.name}</button>)}</article>)}{!!active.length&&!watched.length&&<p>No games in the current feed for your follows. Your team follows remain saved until they expire.</p>}<a href="#following">Manage follows →</a></>}{items.length>active.length&&<p>Completed games and expired follows have been removed from this list.</p>}<button onClick={async()=>{try{setMessage(await syncFollowing());}catch(e){setMessage(e instanceof Error?e.message:'Could not update delivery.');}}}>Retry saving alerts</button><p role="status">{message}</p></section>;
}
