"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {CHANGED} from '../lib/following-client';
import {readControl} from '../lib/notification-client';
import type {HistoryEntry} from '../lib/notification-history';
import {pulseLabels,type PulseType} from '../lib/pulse-preferences';
export default function NotificationInbox(){
 const generation=useRef({value:0}),identity=useRef(''),mutations=useRef(0);
 const [entries,setEntries]=useState<HistoryEntry[]>([]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const request=useCallback(async(action:'list'|'dismiss'|'clear',eventId?:string)=>{
  const control=readControl();const key=control?control.id+':'+control.token:'',changed=identity.current!==key;if(changed){identity.current=key;setEntries([]);}if(action==='list'&&mutations.current>0&&!changed)return;const current=++generation.current.value;if(!control){setBusy(false);setStatus('History is private to this device’s saved notification subscription. Open the installed app where you enabled notifications.');return;}
  if(action!=='list')mutations.current++;setBusy(true);setStatus('');try{
   const r=await fetch('/api/alerts/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...control,action,eventId})});const result=await r.json();if(current!==generation.current.value)return;if(!r.ok){if(r.status===403||r.status===400)setEntries([]);throw Error(result.error||'Could not update history.');}
   if(action==='list')setEntries(result.entries||[]);else if(action==='clear'){setEntries([]);setStatus('History cleared.');}else {setEntries(old=>old.filter(e=>e.id!==eventId));setStatus('Alert dismissed.');}
  }catch(e){if(current!==generation.current.value)return;setStatus(e instanceof Error?e.message:'History is unavailable. Retry when connected.');}finally{if(action!=='list')mutations.current--;if(current===generation.current.value)setBusy(false);}
 },[]);
 useEffect(()=>{const counter=generation.current;const refresh=()=>{void request('list');};refresh();window.addEventListener(CHANGED,refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('storage',refresh);return()=>{counter.value++;window.removeEventListener(CHANGED,refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('storage',refresh);};},[request]);
 return <section id="notification-history" aria-labelledby="notification-history-heading" className="notificationInbox"><h2 id="notification-history-heading">Notification History</h2><p>Private to this device. Most recent 100 alerts, retained for up to 30 days. Entries show when an alert was generated; they do not prove an OS banner was seen.</p><div className="alertActions"><button disabled={busy} onClick={()=>request('list')}>Refresh history</button><button disabled={busy||!entries.length} onClick={()=>request('clear')}>Clear history</button></div><p role="status">{busy?'Updating history…':status}</p>{!busy&&!entries.length&&!status&&<p>No alerts in this device’s history. History starts with v0.8; older delivery diagnostics are kept separately.</p>}<ol>{entries.map(e=><li className="detailCard" key={e.id}><p>{e.types.map(t=>pulseLabels[t as PulseType]||({ap:'AP rankings',coaches:'Coaches rankings',cfp:'CFP rankings'} as Record<string,string>)[t]||t).join(' · ')}</p><h3><a href={e.url}>{e.title}</a></h3><p>{e.body}</p><time dateTime={new Date(e.generatedAt).toISOString()}>{new Date(e.generatedAt).toLocaleString(undefined,{timeZoneName:'short'})}</time><p>Generated · device display unverified</p><button disabled={busy} onClick={()=>request('dismiss',e.id)}>Dismiss {e.title}</button></li>)}</ol></section>;
}
