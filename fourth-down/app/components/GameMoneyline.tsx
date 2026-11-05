"use client";
import {useEffect,useState} from 'react';
import type {gameMoneyline} from '../lib/game-extras';
type Packet={observedAt:string;odds:Record<string,ReturnType<typeof gameMoneyline>>};
let cached:Packet|null=null,flight:Promise<Packet>|null=null,loaded=0;
function load(){
 if(cached&&Date.now()-loaded<120000)return Promise.resolve(cached);
 if(!flight)flight=fetch('/api/game-extras').then(async response=>{if(!response.ok)throw Error();const result=await response.json() as Packet;
 if(!result.odds||!Number.isFinite(Date.parse(result.observedAt)))throw Error();cached=result;loaded=Date.now();return result;
 }).finally(()=>{flight=null;});
 return flight;
}
export default function GameMoneyline({id}:{id:string}){
 const [packet,setPacket]=useState<Packet|null>(null);
 useEffect(()=>{let active=true;const refresh=()=>{if(document.hidden)return;void load().then(value=>{if(active)setPacket(value);}).catch(()=>{if(active)setPacket(null);});};refresh();const timer=setInterval(refresh,120000);document.addEventListener('visibilitychange',refresh);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[]);
 const odds=packet?.odds[id];const stale=!!packet&&Date.now()-Date.parse(packet.observedAt)>240000;
 return <div className="gameMoneyline" aria-label="Moneyline odds">{odds&&!stale?<><small>{odds.kind==='live'?'Live':'Pregame'} moneyline · {odds.provider} via ESPN</small><div>{odds.teams.map(team=><span key={team.id}>{team.name} <strong>{team.moneyline}</strong> </span>)}</div><small>{odds.sourceAt?'Provider updated '+new Date(odds.sourceAt).toLocaleTimeString():'Provider update time unavailable'} · Retrieved {new Date(odds.observedAt).toLocaleTimeString()}</small></>:<small>{stale?'Moneylines stale · refreshing':'Moneylines unavailable'}</small>}</div>;
}
