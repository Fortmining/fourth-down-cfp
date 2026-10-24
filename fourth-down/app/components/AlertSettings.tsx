"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultGameAlerts,defaultAlertPreferences,hasAlerts,normalizePreferences,type AlertPreferences } from '../lib/alerts';
import {DRAFT,persistNotifications,writeWorker} from '../lib/notification-client';
import PulsePreferences from './PulsePreferences';
import UnsavedGuard from './UnsavedGuard';
import {CHANGED,inspectThisDevice} from '../lib/following-client';
const PREFS='fourth-down-alert-preferences-v1';
const CONTROL='fourth-down-push-control-v1';
type Control={id:string;token:string};
type Team={id:string;name:string};
type Props={teams:Team[]};
function read<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
export default function AlertSettings({teams}:Props) {
 const [preferences,setPreferences]=useState(defaultAlertPreferences);
 const [config,setConfig]=useState<{available:boolean;publicKey:string|null}|null>(null);
 const [control,setControl]=useState<Control|null>(null);
 const [search,setSearch]=useState('');const [status,setStatus]=useState('');
 const [inspectionStatus,setInspectionStatus]=useState('');
 const [saved,setSaved]=useState(false);
 useEffect(()=>{if(!saved)return;const timer=setTimeout(()=>setSaved(false),5000);return()=>clearTimeout(timer);},[saved]);
 const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);
 const [storageOk,setStorageOk]=useState(true);const [supported,setSupported]=useState(false);
 const [permission,setPermission]=useState<NotificationPermission>('default');
 const [browserSubscribed,setBrowserSubscribed]=useState<boolean|null>(null);
 const [dirty,setDirty]=useState(false);const working=useRef(false);const followingEdited=useRef(false);
 useEffect(()=>{
  const initial=normalizePreferences(read(DRAFT,read(PREFS,null)));setPreferences(initial);followingEdited.current=localStorage.getItem('fourth-down-follow-master-draft')==='true';
  setControl(read(CONTROL,null));
  if(localStorage.getItem('fourth-down-worker-pending')==='true')setStatus('Server settings are saved. Save Changes again to refresh this device’s delivery controls.');
  if(read<Control|null>(CONTROL,null)&&'serviceWorker' in navigator)void navigator.serviceWorker.getRegistration('/').then(reg=>reg?.update()).catch(()=>{});
  try{setDirty(localStorage.getItem(DRAFT)!==null||localStorage.getItem('fourth-down-alert-settings-pending-v1')==='true');}catch{}
  try {if(!localStorage.getItem(PREFS))localStorage.setItem(PREFS,JSON.stringify(initial));}catch{setStorageOk(false);}
  setSupported('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  if('Notification' in window)setPermission(Notification.permission);
  fetch('/api/alerts/config',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(setConfig).catch(()=>setConfig({available:false,publicKey:null}));
  setReady(true);
  function changed(e:StorageEvent) {
   if(e.key===PREFS&&!localStorage.getItem(DRAFT)){setPreferences(normalizePreferences(read(PREFS,null)));}
   if(e.key===CONTROL)setControl(read(CONTROL,null));
  if(read<Control|null>(CONTROL,null)&&'serviceWorker' in navigator)void navigator.serviceWorker.getRegistration('/').then(reg=>reg?.update()).catch(()=>{});
  }
  function inspectPermission() {
   if('Notification' in window)setPermission(Notification.permission);
   if('serviceWorker' in navigator)navigator.serviceWorker.getRegistration('/').then(reg=>reg?.pushManager.getSubscription()).then(sub=>setBrowserSubscribed(!!sub)).catch(()=>setBrowserSubscribed(false));
  }
  inspectPermission();window.addEventListener('focus',inspectPermission);
  const refresh=()=>{setControl(read(CONTROL,null));if(!localStorage.getItem(DRAFT))setPreferences(normalizePreferences(read(PREFS,null)));};window.addEventListener(CHANGED,refresh);
  window.addEventListener('storage',changed);return()=>{window.removeEventListener(CHANGED,refresh);window.removeEventListener('storage',changed);window.removeEventListener('focus',inspectPermission);};
 },[]);
 function change(next:AlertPreferences) {
  setPreferences(next);setDirty(true);setSaved(false);setStatus('');
  try{localStorage.setItem(DRAFT,JSON.stringify(next));localStorage.setItem('fourth-down-alert-settings-pending-v1','true');}catch{setStorageOk(false);setStatus('Browser storage is unavailable. Enable storage to keep settings and unsubscribe controls.');}
 }
 const choices=useMemo(()=>{
  const all=new Map([...preferences.favorites,...teams].map(t=>[t.id,t]));
  return [...all.values()].filter(t=>t.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
 },[teams,preferences.favorites,search]);
 const active=!!control;
 const permissionLabel=!supported?'Not available in this browser':permission==='granted'?'Allowed':permission==='denied'?'Blocked':'Not requested';
 function discard(){localStorage.removeItem(DRAFT);localStorage.removeItem('fourth-down-follow-master-draft');followingEdited.current=false;localStorage.removeItem('fourth-down-alert-settings-pending-v1');setPreferences(normalizePreferences(read(PREFS,null)));setDirty(false);setSaved(false);setStatus('');}
 async function save():Promise<boolean> {
  if(working.current||!storageOk)return false;
  working.current=true;setBusy(true);setSaved(false);setStatus('');
  try{
   // A follow saved while this page is being edited remains authoritative.
   const latest=normalizePreferences(read(PREFS,null));const p={...preferences,following:{enabled:followingEdited.current?preferences.following?.enabled===true:latest.following?.enabled===true,items:latest.following?.items||[]}};
   const message=await persistNotifications(p);setPreferences(normalizePreferences(read(PREFS,null)));setControl(read(CONTROL,null));setBrowserSubscribed(true);setDirty(false);followingEdited.current=false;localStorage.removeItem('fourth-down-follow-master-draft');if(message==='Saved. Your notification choices are confirmed by the server.'){setStatus('');setSaved(true);}else setStatus(message);return true;
  }catch(error){setStatus(error instanceof Error?error.message:'Could not save. Your changes are still here; retry.');return false;}
  finally{working.current=false;setBusy(false);}
 }
 async function inspectDevice(){if(working.current)return;working.current=true;setBusy(true);setInspectionStatus('Reading this device and saving its report…');try{setInspectionStatus(await inspectThisDevice());}catch(e){setInspectionStatus(e instanceof Error?e.message:'Device inspection failed.');}finally{working.current=false;setBusy(false);}}
 async function testDelivery(mode?:'background') {
  if(!control||working.current)return;working.current=true;setBusy(true);
  try{const r=await fetch('/api/alerts/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...control,mode})});const result=await r.json();setStatus(result.message||result.error||'Test could not be confirmed.');}
  catch{setStatus('Test delivery could not be confirmed.');}finally{working.current=false;setBusy(false);}
 }
 async function unsubscribe() {
  if(working.current)return;working.current=true;setBusy(true);setStatus('');
  try{
   const off={...preferences,pulse:preferences.pulse?{...preferences.pulse,enabled:false}:undefined,following:{...preferences.following!,enabled:false},myTeams:{...preferences.myTeams,enabled:false},breaking:{...preferences.breaking,enabled:false}};
   change(off);
   if('serviceWorker' in navigator)await writeWorker(off);
   if(control){
    const r=await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',...control})});
    if(!r.ok)throw Error('Server unsubscribe could not be confirmed. This device is muted; retry to remove the server subscription.');
   }
   if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration('/');const sub=await reg?.pushManager.getSubscription();if(sub)await sub.unsubscribe();}
   localStorage.setItem(PREFS,JSON.stringify(off));localStorage.removeItem(DRAFT);localStorage.removeItem(CONTROL);window.dispatchEvent(new Event(CHANGED));localStorage.removeItem('fourth-down-alert-settings-pending-v1');setControl(null);setBrowserSubscribed(false);setDirty(false);setStatus('Unsubscribed from all alerts on this device. Your favorite teams are kept.');
  }catch(error){setStatus(error instanceof Error?error.message:'Could not confirm unsubscribe. Please retry.');}
  finally{working.current=false;setBusy(false);}
 }
 function category(group:'myTeams'|'breaking',key:string,value:boolean) {change({...preferences,[group]:{...preferences[group],[key]:value}});}
 function gameType(group:'favorites'|'following',type:string,value:boolean){const choices=preferences.gameAlerts||defaultGameAlerts();change({...preferences,gameAlerts:{...choices,[group]:{...choices[group],[type]:value}}});}
 const gameLabels={halftime:'Halftime scores',close:'Close game',upsetWatch:'Upset Watch',confirmedUpset:'Confirmed Upset',scoring:'Scoring updates'} as const;
 const gameChoices=(group:'favorites'|'following')=><div className="alertTypeChoices">{(Object.keys(gameLabels) as (keyof typeof gameLabels)[]).filter(t=>group==='following'||!['close','scoring'].includes(t)).map(type=><label key={type}><input type="checkbox" aria-label={`${group==='following'?'Temporary follows':'Favorite teams'} · ${gameLabels[type]}`} checked={preferences.gameAlerts?.[group][type]===true} onChange={e=>gameType(group,type,e.target.checked)}/>{gameLabels[type]}</label>)}</div>;
 return <section id="alerts" className="alertSettings" aria-labelledby="alert-settings-heading">
  <UnsavedGuard dirty={dirty} save={save} discard={discard} busy={busy}/>
  <h2 id="alert-settings-heading">Notifications</h2>
  <div className="notificationSave"><p role="status" aria-live="polite" aria-atomic="true">{saved?<><span aria-hidden="true">✓ </span>Saved<span className="srOnly">. Server confirmed your changes.</span></>:status?<a href="#notification-feedback">{dirty?'Not saved':'Review'}</a>:dirty&&!busy?'Unsaved changes':''}</p><button aria-describedby={status?'notification-feedback':undefined} disabled={!ready||busy||!storageOk} onClick={save}>{busy?'Saving…':'Save Changes'}</button></div>
  {status&&<p id="notification-feedback" className="notificationFeedback" role="alert" tabIndex={-1}>{status}</p>}
  <PulsePreferences value={preferences.pulse} disabled={!ready||busy} onChange={pulse=>change({...preferences,pulse})}/>
  <details className="notificationSection"><summary>Temporary follows<span className="settingDisclosure" aria-hidden="true"/></summary><fieldset className="followingAlert" disabled={!ready||busy}><legend>Temporary Following</legend><label className="alertToggle"><input type="checkbox" checked={preferences.following?.enabled===true} onChange={e=>{followingEdited.current=true;localStorage.setItem('fourth-down-follow-master-draft','true');change({...preferences,following:{items:preferences.following?.items||[],enabled:e.target.checked}});}}/><span><b>Following alerts</b><small>Choose defaults for follows without individual choices. Manage each follow in Following. Independent of permanent favorites and rankings.</small></span></label><p>Game and team dialogs have individual choices. This switch pauses all follow alerts.</p><div className="alertTypeChoices">{(['kickoff','final'] as const).map(type=><label key={type}><input type="checkbox" aria-label={`Temporary follows · ${type==='kickoff'?'Kickoff confirmed':'Final scores'}`} checked={preferences.gameAlerts?.following[type]!==false} onChange={e=>gameType('following',type,e.target.checked)}/>{type==='kickoff'?'Kickoff confirmed':'Final scores'}</label>)}</div>{gameChoices('following')}</fieldset></details>
  <div className="alertCategories">
   <details className="notificationSection"><summary>Favorite teams<span className="settingDisclosure" aria-hidden="true"/></summary><fieldset disabled={!ready||busy}><legend>My Teams</legend>
    <label className="alertToggle"><input type="checkbox" checked={preferences.myTeams.enabled} onChange={e=>category('myTeams','enabled',e.target.checked)}/><span><b>My Teams alerts</b><small>Only the teams you choose.</small></span></label>
    <div className="alertTypeChoices">
     <label><input type="checkbox" checked={preferences.myTeams.kickoff} onChange={e=>category('myTeams','kickoff',e.target.checked)}/> Kickoff confirmed</label>
     <label><input type="checkbox" checked={preferences.myTeams.final} onChange={e=>category('myTeams','final',e.target.checked)}/> Final scores</label>
    </div>
    {gameChoices('favorites')}
    <p className="alertHint">Kickoff alerts follow ESPN’s confirmed live status. Finals require a completed game and valid scores.</p>
    <label className="teamSearch">Find your teams<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by team name"/></label>
    <p className="alertHint">{preferences.favorites.length} of 20 teams selected · Teams from available FBS schedules and rankings.</p>
    <div className="favoriteChips">{preferences.favorites.map(t=><button key={t.id} onClick={()=>change({...preferences,favorites:preferences.favorites.filter(x=>x.id!==t.id)})} aria-label={`Remove ${t.name}`}>{t.name} ×</button>)}</div>
    <div className="favoriteList" role="group" aria-label="Favorite teams">{choices.map(t=><label key={t.id}><input type="checkbox" checked={preferences.favorites.some(x=>x.id===t.id)} disabled={!preferences.favorites.some(x=>x.id===t.id)&&preferences.favorites.length>=20} onChange={e=>change({...preferences,favorites:e.target.checked?[...preferences.favorites,t]:preferences.favorites.filter(x=>x.id!==t.id)})}/>{t.name}</label>)}{!choices.length&&<p className="alertHint">{teams.length?'No matching teams. Try another name.':'Team choices appear once the live feed loads.'}</p>}</div>
   </fieldset></details>
   <details className="notificationSection"><summary>Breaking CFP News<span className="settingDisclosure" aria-hidden="true"/></summary><fieldset disabled={!ready||busy}><legend>Breaking CFP News</legend>
    <label className="alertToggle"><input type="checkbox" checked={preferences.breaking.enabled} onChange={e=>category('breaking','enabled',e.target.checked)}/><span><b>Breaking CFP News alerts</b><small>Independent of your favorite teams.</small></span></label>
    <div className="alertTypeChoices">
     <label><input type="checkbox" checked={preferences.breaking.upsets} onChange={e=>category('breaking','upsets',e.target.checked)}/> Confirmed major upsets</label>
     <label><input type="checkbox" checked={preferences.breaking.developments} onChange={e=>category('breaking','developments',e.target.checked)}/> Verified playoff developments</label>
     <label><input type="checkbox" checked={preferences.breaking.ap} onChange={e=>category('breaking','ap',e.target.checked)}/> New AP Top 25</label>
     <label><input type="checkbox" checked={preferences.breaking.coaches} onChange={e=>category('breaking','coaches',e.target.checked)}/> New Coaches Poll</label>
     <label><input type="checkbox" checked={preferences.breaking.cfp} onChange={e=>category('breaking','cfp',e.target.checked)}/> New CFP committee rankings</label>
    </div>
    <details className="alertPolicy"><summary>How we verify breaking alerts</summary><p className="alertHint">Major upset means a confirmed final in which a provider-ranked top-10 team loses to an unranked team or one ranked at least 10 places lower. No alerts during a possible upset.</p>
    <p className="alertHint">Playoff developments require an editor-verified report linked to an official or established source. Rankings alerts require a new published edition. No projections, rumors, historical catch-up alerts, or substitution between polls.</p></details>
   </fieldset></details>
  </div>
  <details className="alertPolicy"><summary>Game alert rules & repeat limits</summary><p>Close game: margin of eight points or less in the final five minutes of Q4, or overtime. Upset Watch: in that same late window, an AP top-10 team leads by eight or less, is tied, or trails an unranked team or one at least ten places lower. Confirmed Upset requires a verified final and winner.</p><p>AP rankings are frozen for each game from the published pregame or first-quarter edition. Missing AP data means no new upset alerts; Coaches and CFP are not substituted. Halftime requires ESPN’s halftime state and scores. Scoring updates may combine multiple scores between checks and are limited to one per game every ten minutes.</p><p>Close game and Upset Watch share one alert per regulation/overtime phase and a five-minute game cooldown. At most six optional live alerts per device in a rolling 15-minute window. Kickoff, finals and ranking publications keep their own event identities. All new types stay off until selected and saved.</p></details>
  <details className="notificationSection"><summary>Device & delivery<span className="settingDisclosure" aria-hidden="true"/></summary><div className="alertDelivery">
   <p className="permissionStatus">Notification permission: <b>{ready?permissionLabel:'Checking…'}</b></p>
   <b>{!ready?'Checking this device…':active&&browserSubscribed===false?'Saved subscription needs renewal. Unsubscribe, then enable again.':active?dirty?'Settings changed · save to update delivery':'Subscribed on this device':'No active subscription on this device'}</b>
   {ready&&!supported&&<p>This browser cannot enable push here. On iPhone, open the installed Home Screen app first.</p>}
   {ready&&config&&!config.available&&<p>{active?'Background checks are temporarily unavailable. Your subscription is saved, but delivery cannot currently be confirmed.':'Background delivery is being set up. Your choices are saved; alerts are not active yet.'}</p>}
   {!storageOk&&<p role="alert">Browser storage is blocked. Persistent settings and alert controls require storage.</p>}
   {permission==='denied'&&<p>Notifications are blocked in browser or device settings. No permission prompts will be repeated automatically.</p>}
   <div className="alertActions">{active&&<button disabled={busy||dirty||permission!=='granted'} onClick={()=>testDelivery()}>Send test notification</button>}{active&&<button disabled={busy||dirty||permission!=='granted'} onClick={()=>testDelivery('background')}>Send background test</button>}<button disabled={!ready||busy} onClick={unsubscribe}>Unsubscribe from all alerts</button></div>
   {active&&<p>To turn off one category or alert type, uncheck it and save alert settings. Unsubscribe from all stops both categories and keeps your favorites.</p>}
   {!hasAlerts(preferences)&&ready&&<p>Select a category and at least one alert type. My Teams also needs a favorite team.</p>}
   <div className="alertActions"><button disabled={!ready||busy} onClick={inspectDevice} aria-describedby="device-inspection-status">Inspect this device</button></div><p id="device-inspection-status" role="status" aria-live="polite" aria-atomic="true">{inspectionStatus}</p><p className="alertHint">Read saved follow timestamps and delivery diagnostics from this browser or installed app. This does not change settings, request permission, or send a test.</p><details className="alertPolicy"><summary>Delivery & privacy</summary><p>Push may be delayed by your browser, device, or the feed. A single event matching both categories produces one notification. Clearing browser data removes these local controls; you can always revoke notifications in device settings.</p></details>

  </div></details>
 </section>;
}
