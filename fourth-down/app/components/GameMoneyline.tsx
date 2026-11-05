"use client";
import './moneyline.css';
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
export function useGameMoneyline(id:string){
 const [packet,setPacket]=useState<Packet|null>(null);
 useEffect(()=>{let active=true;const refresh=()=>{if(document.hidden)return;void load().then(value=>{if(active)setPacket(value);}).catch(()=>{if(active)setPacket(null);});};refresh();const timer=setInterval(refresh,120000);document.addEventListener('visibilitychange',refresh);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[]);
 const odds=packet?.odds[id];const stale=!!packet&&Date.now()-Date.parse(packet.observedAt)>240000;
 return {odds:stale?null:odds,stale};
}
export function MoneylineFooter({odds,stale}:{odds:ReturnType<typeof gameMoneyline>|undefined;stale:boolean}){
 if(!odds)return <div className="cardOddsFooter">{stale?'Moneylines stale · refreshing':'Moneylines unavailable'}</div>;
 const at=odds.sourceAt||odds.observedAt;
 return <div className="cardOddsFooter"><span>{odds.kind==='live'?'Live':'Pregame'} ML · {odds.provider}</span><time dateTime={at}>{odds.sourceAt?'Updated':'Fetched'} {new Date(at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</time></div>;
}
export default function GameMoneyline({id}:{id:string}){
 const {odds,stale}=useGameMoneyline(id);
 return <div className="gameMoneyline" aria-label="Moneyline odds">{odds?<><div>{odds.teams.map(team=><span key={team.id}>{team.name} <strong>{team.moneyline}</strong> </span>)}</div><MoneylineFooter odds={odds} stale={stale}/></>:<MoneylineFooter odds={odds} stale={stale}/>}</div>;
}
