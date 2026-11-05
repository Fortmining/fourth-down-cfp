"use client";
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
 return <section aria-label="Watch Live"><h3>Watch Live</h3>{destination?<><a className="detailButton" href={destination.url} target="_blank" rel="noopener noreferrer">{destination.label} ↗</a><p>{destination.exact?'Provider link for this event.':'Provider destination · choose this game in the provider’s schedule.'} Subscription, TV sign-in and regional availability may apply. Opens the provider’s app where supported, with its website as fallback.</p></>:<p>Streaming link unavailable{broadcast?' · Broadcast: '+broadcast:''}.</p>}</section>;
}
