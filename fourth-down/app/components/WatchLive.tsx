"use client";
import './watch-live.css';
import {ArrowUpRight, Tv} from 'lucide-react';
import {useEffect,useState} from 'react';
import {watchDestination} from '../lib/game-extras';
export default function WatchLive({id,broadcast,links=[]}:{id:string;broadcast:string;links?:{href?:string;rel?:string[]}[]}){
 const [verified,setVerified]=useState<ReturnType<typeof watchDestination>>(null);
 useEffect(()=>{let active=true;void fetch('/api/games/'+encodeURIComponent(id)).then(r=>r.ok?r.json():null).then(data=>{
  if(active&&data?.game?.id===id&&data.watch?.exact===true){
   const checked=watchDestination([{href:data.watch.url,rel:['watch']}], '');
   if(checked)setVerified(checked);
  }
 }).catch(()=>{});return()=>{active=false;};},[id]);
 const destination=verified??watchDestination(links,broadcast);
 const provider = destination?.exact
   ? (({
       'espn.com': 'ESPN Watch',
       'cbssports.com': 'CBS Sports',
       'foxsports.com': 'FOX Sports',
       'peacocktv.com': 'Peacock',
     } as Record<string, string>)[new URL(destination.url).hostname.replace(/^www\./, '')] ?? 'Streaming provider')
   : broadcast.trim() || destination?.label.replace(/^Open /, '');

 return (
   <section className="watchLivePanel" aria-label="Watch Live">
     <Tv className="watchLiveIcon" size={18} aria-hidden="true" />
     <div className="watchLiveCopy">
       <h3>Watch Live</h3>
       {provider && <p className="watchLiveProvider">{provider}</p>}
       <p>{destination ? 'Provider sign-in may be required.' : 'Streaming link unavailable.'}</p>
     </div>
     {destination && (
       <a className="detailButton watchLiveAction" href={destination.url}
         target="_blank" rel="noopener noreferrer" aria-label={`Watch on ${provider} (opens in a new tab)`}>
         Watch <ArrowUpRight size={14} aria-hidden="true" />
       </a>
     )}
   </section>
 );
}
