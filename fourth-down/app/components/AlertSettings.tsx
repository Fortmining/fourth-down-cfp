"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultGameAlerts,defaultAlertPreferences,hasAlerts,normalizePreferences,type AlertPreferences } from '../lib/alerts';
import {CHANGED,inspectThisDevice} from '../lib/following-client';
const PREFS='fourth-down-alert-preferences-v1';
const CONTROL='fourth-down-push-control-v1';
type Control={id:string;token:string};
type Team={id:string;name:string};
type Props={teams:Team[]};
function read<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function keyBytes(key:string) {const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function syncWorker(p:AlertPreferences) {
 const registration=await navigator.serviceWorker.getRegistration('/');
 if(!registration?.active)return;
 await new Promise<void>((resolve,reject)=>{
  const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();reject(Error('Could not save local delivery controls. Try again.'));},5000);
  channel.port1.onmessage=event=>{clearTimeout(timeout);channel.port1.close();if(event.data?.ok)resolve();else reject(Error('Notification storage is unavailable.'));};
  registration.active!.postMessage({type:'alert-preferences',preferences:p},[channel.port2]);
 });
}
export default function AlertSettings({teams}:Props) {
 const [preferences,setPreferences]=useState(defaultAlertPreferences);
 const [config,setConfig]=useState<{available:boolean;publicKey:string|null}|null>(null);
 const [control,setControl]=useState<Control|null>(null);
 const [search,setSearch]=useState('');const [status,setStatus]=useState('');
 const [inspectionStatus,setInspectionStatus]=useState('');
 const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);
 const [storageOk,setStorageOk]=useState(true);const [supported,setSupported]=useState(false);
 const [permission,setPermission]=useState<NotificationPermission>('default');
 const [browserSubscribed,setBrowserSubscribed]=useState<boolean|null>(null);
 const [dirty,setDirty]=useState(false);const working=useRef(false);
 useEffect(()=>{
  const initial=normalizePreferences(read(PREFS,null));setPreferences(initial);
  setControl(read(CONTROL,null));
  if(read<Control|null>(CONTROL,null)&&'serviceWorker' in navigator)void navigator.serviceWorker.getRegistration('/').then(reg=>reg?.update()).catch(()=>{});
  try{setDirty(localStorage.getItem('fourth-down-alert-settings-pending-v1')==='true');}catch{}
  try {localStorage.setItem(PREFS,JSON.stringify(initial));}catch{setStorageOk(false);}
  setSupported('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  if('Notification' in window)setPermission(Notification.permission);
  fetch('/api/alerts/config',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(setConfig).catch(()=>setConfig({available:false,publicKey:null}));
  setReady(true);
  function changed(e:StorageEvent) {
   if(e.key===PREFS){setPreferences(normalizePreferences(read(PREFS,null)));setDirty(true);}
   if(e.key===CONTROL)setControl(read(CONTROL,null));
  if(read<Control|null>(CONTROL,null)&&'serviceWorker' in navigator)void navigator.serviceWorker.getRegistration('/').then(reg=>reg?.update()).catch(()=>{});
  }
  function inspectPermission() {
   if('Notification' in window)setPermission(Notification.permission);
   if('serviceWorker' in navigator)navigator.serviceWorker.getRegistration('/').then(reg=>reg?.pushManager.getSubscription()).then(sub=>setBrowserSubscribed(!!sub)).catch(()=>setBrowserSubscribed(false));
  }
  inspectPermission();window.addEventListener('focus',inspectPermission);
  const refresh=()=>setPreferences(normalizePreferences(read(PREFS,null)));window.addEventListener(CHANGED,refresh);
  window.addEventListener('storage',changed);return()=>{window.removeEventListener(CHANGED,refresh);window.removeEventListener('storage',changed);window.removeEventListener('focus',inspectPermission);};
 },[]);
 function change(next:AlertPreferences) {
  setPreferences(next);setDirty(true);setStatus('Saved on this device. Save alert settings to update delivery.');
  try{localStorage.setItem(PREFS,JSON.stringify(next));window.dispatchEvent(new Event(CHANGED));localStorage.setItem('fourth-down-alert-settings-pending-v1','true');}catch{setStorageOk(false);setStatus('Browser storage is unavailable. Enable storage to keep settings and unsubscribe controls.');}
 }
 const choices=useMemo(()=>{
  const all=new Map([...preferences.favorites,...teams].map(t=>[t.id,t]));
  return [...all.values()].filter(t=>t.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
 },[teams,preferences.favorites,search]);
 const active=!!control;
 const permissionLabel=!supported?'Not available in this browser':permission==='granted'?'Allowed':permission==='denied'?'Blocked':'Not requested';
 async function save() {
  if(control&&!hasAlerts(preferences)){await unsubscribe();return;}
  if(working.current||!storageOk||!supported||!config?.available||!config.publicKey||!hasAlerts(preferences))return;
  working.current=true;setBusy(true);setStatus('');
  let createdBrowserSubscription:PushSubscription|null=null;
  try{
   // Permission is requested only from this explicit button gesture.
   const grant=await Notification.requestPermission();setPermission(grant);
   if(grant!=='granted'){setStatus('Notifications are not allowed. You can change permission in browser or device settings.');return;}
   const registration=await navigator.serviceWorker.register('/alerts-sw.js',{scope:'/'});
   await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.publicKey)});createdBrowserSubscription=subscription;}
   await syncWorker(preferences);
   const response=await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:control?'update':'create',...control,subscription:subscription.toJSON(),preferences})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Could not save alerts.');
   const next={id:result.id,token:result.token};
   try{localStorage.setItem(CONTROL,JSON.stringify(next));}catch{
    await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',...next})});
    await subscription.unsubscribe();throw Error('Storage is blocked. Alerts were not enabled.');
   }
   localStorage.removeItem('fourth-down-alert-settings-pending-v1');setControl(next);setBrowserSubscribed(true);setDirty(false);localStorage.removeItem('fourth-down-following-pending');setStatus('Background alerts are on for your selected categories and types.');
  }catch(error){
   if(createdBrowserSubscription)await createdBrowserSubscription.unsubscribe().catch(()=>false);
   setStatus(error instanceof Error?error.message:'Could not enable alerts. Try again.');
  }finally{working.current=false;setBusy(false);}
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
   const off={...preferences,following:{...preferences.following!,enabled:false},myTeams:{...preferences.myTeams,enabled:false},breaking:{...preferences.breaking,enabled:false}};
   change(off);
   if('serviceWorker' in navigator)await syncWorker(off);
   if(control){
    const r=await fetch('/api/alerts/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',...control})});
    if(!r.ok)throw Error('Server unsubscribe could not be confirmed. This device is muted; retry to remove the server subscription.');
   }
   if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration('/');const sub=await reg?.pushManager.getSubscription();if(sub)await sub.unsubscribe();}
   localStorage.removeItem(CONTROL);localStorage.removeItem('fourth-down-alert-settings-pending-v1');setControl(null);setBrowserSubscribed(false);setDirty(false);setStatus('Unsubscribed from all alerts on this device. Your favorite teams are kept.');
  }catch(error){setStatus(error instanceof Error?error.message:'Could not confirm unsubscribe. Please retry.');}
  finally{working.current=false;setBusy(false);}
 }
 function category(group:'myTeams'|'breaking',key:string,value:boolean) {change({...preferences,[group]:{...preferences[group],[key]:value}});}
 function gameType(group:'favorites'|'following',type:string,value:boolean){const choices=preferences.gameAlerts||defaultGameAlerts();change({...preferences,gameAlerts:{...choices,[group]:{...choices[group],[type]:value}}});}
 const gameLabels={halftime:'Halftime scores',close:'Close game',upsetWatch:'Upset Watch',confirmedUpset:'Confirmed Upset',scoring:'Scoring updates'} as const;
 const gameChoices=(group:'favorites'|'following')=><div className="alertTypeChoices">{(Object.keys(gameLabels) as (keyof typeof gameLabels)[]).filter(t=>group==='following'||!['close','scoring'].includes(t)).map(type=><label key={type}><input type="checkbox" aria-label={`${group==='following'?'Temporary follows':'Favorite teams'} · ${gameLabels[type]}`} checked={preferences.gameAlerts?.[group][type]===true} onChange={e=>gameType(group,type,e.target.checked)}/>{gameLabels[type]}</label>)}</div>;
 return <section id="alerts" className="alertSettings" aria-labelledby="alert-settings-heading">
  <div className="intro"><div><div className="eyebrow">YOUR GAME DAY. YOUR CHOICE.</div><h2 id="alert-settings-heading">Notifications</h2></div><span className="badge">OFF UNTIL YOU OPT IN</span></div>
  <p className="context">Choose alerts for permanent favorites, temporary follows, and ranking publications separately. Settings are saved on this device; notification permission is only requested when you enable alerts.</p>
  <fieldset className="followingAlert" disabled={!ready||busy}><legend>Temporary Following</legend><label className="alertToggle"><input type="checkbox" checked={preferences.following?.enabled===true} onChange={e=>change({...preferences,following:{items:preferences.following?.items||[],enabled:e.target.checked}})}/><span><b>Following alerts</b><small>Choose alert types for active follows. Independent of permanent favorites and rankings.</small></span></label><p>Following a game or team only adds it to your watchlist. Select this switch and save or enable notifications to receive alerts.</p><div className="alertTypeChoices">{(['kickoff','final'] as const).map(type=><label key={type}><input type="checkbox" aria-label={`Temporary follows · ${type==='kickoff'?'Kickoff confirmed':'Final scores'}`} checked={preferences.gameAlerts?.following[type]!==false} onChange={e=>gameType('following',type,e.target.checked)}/>{type==='kickoff'?'Kickoff confirmed':'Final scores'}</label>)}</div>{gameChoices('following')}</fieldset>
  <div className="alertCategories">
   <fieldset disabled={!ready||busy}><legend>My Teams</legend>
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
   </fieldset>
   <fieldset disabled={!ready||busy}><legend>Breaking CFP News</legend>
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
   </fieldset>
  </div>
  <details className="alertPolicy"><summary>Game alert rules & repeat limits</summary><p>Close game: margin of eight points or less in the final five minutes of Q4, or overtime. Upset Watch: in that same late window, an AP top-10 team leads by eight or less, is tied, or trails an unranked team or one at least ten places lower. Confirmed Upset requires a verified final and winner.</p><p>AP rankings are frozen for each game from the published pregame or first-quarter edition. Missing AP data means no new upset alerts; Coaches and CFP are not substituted. Halftime requires ESPN’s halftime state and scores. Scoring updates may combine multiple scores between checks and are limited to one per game every ten minutes.</p><p>Close game and Upset Watch share one alert per regulation/overtime phase and a five-minute game cooldown. At most six optional live alerts per device in a rolling 15-minute window. Kickoff, finals and ranking publications keep their own event identities. All new types stay off until selected and saved.</p></details>
  <div className="alertDelivery">
   <p className="permissionStatus">Notification permission: <b>{ready?permissionLabel:'Checking…'}</b></p>
   <b>{!ready?'Checking this device…':active&&browserSubscribed===false?'Saved subscription needs renewal. Unsubscribe, then enable again.':active?dirty?'Settings changed · save to update delivery':'Subscribed on this device':'No active subscription on this device'}</b>
   {ready&&!supported&&<p>This browser cannot enable push here. On iPhone, open the installed Home Screen app first.</p>}
   {ready&&config&&!config.available&&<p>{active?'Background checks are temporarily unavailable. Your subscription is saved, but delivery cannot currently be confirmed.':'Background delivery is being set up. Your choices are saved; alerts are not active yet.'}</p>}
   {!storageOk&&<p role="alert">Browser storage is blocked. Persistent settings and alert controls require storage.</p>}
   {permission==='denied'&&<p>Notifications are blocked in browser or device settings. No permission prompts will be repeated automatically.</p>}
   <div className="alertActions"><button disabled={!ready||busy||!storageOk||!supported||!config?.available||(!active&&!hasAlerts(preferences))||permission==='denied'} onClick={save}>{busy?'Working…':active?'Save alert settings':'Enable Notifications'}</button>{active&&<button disabled={busy||dirty||permission!=='granted'} onClick={()=>testDelivery()}>Send test notification</button>}{active&&<button disabled={busy||dirty||permission!=='granted'} onClick={()=>testDelivery('background')}>Send background test</button>}<button disabled={!ready||busy} onClick={unsubscribe}>Unsubscribe from all alerts</button></div>
   {active&&<p>To turn off one category or alert type, uncheck it and save alert settings. Unsubscribe from all stops both categories and keeps your favorites.</p>}
   {!hasAlerts(preferences)&&ready&&<p>Select a category and at least one alert type. My Teams also needs a favorite team.</p>}
   <div className="alertActions"><button disabled={!ready||busy} onClick={inspectDevice} aria-describedby="device-inspection-status">Inspect this device</button></div><p id="device-inspection-status" role="status" aria-live="polite" aria-atomic="true">{inspectionStatus}</p><p className="alertHint">Read saved follow timestamps and delivery diagnostics from this browser or installed app. This does not change settings, request permission, or send a test.</p><details className="alertPolicy"><summary>Delivery & privacy</summary><p>Push may be delayed by your browser, device, or the feed. A single event matching both categories produces one notification. Clearing browser data removes these local controls; you can always revoke notifications in device settings.</p></details>
   <p role="status" aria-live="polite">{status}</p>
  </div>
 </section>;
}
