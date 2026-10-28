"use client";
import { useEffect, useRef, useState } from 'react';
import {type WatchGame} from './Following';
import AppearanceControls from './AppearanceControls';
import NotificationInbox from './NotificationInbox';
import AlertSettings from './AlertSettings';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function MoreSettings({teams,resumesAvailable=false}:{resumesAvailable?:boolean;teams:{id:string;name:string}[];games:WatchGame[]}) {
 const [standalone,setStandalone]=useState(false);const [canInstall,setCanInstall]=useState(false);
 const [installStatus,setInstallStatus]=useState('Checking installation mode…');
 const prompt=useRef<InstallPrompt|null>(null);
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');
  function refresh() {const app=media.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;setStandalone(app);setInstallStatus(app?'Opened as the installed Fourth Down app.':'Opened in a browser. An installation in another window or browser cannot be reliably detected here.');}
  function offered(event:Event){event.preventDefault();prompt.current=event as InstallPrompt;setCanInstall(true);}
  function installed(){prompt.current=null;setCanInstall(false);refresh();setInstallStatus('Installation completed. Open Fourth Down from your Home Screen or app launcher.');}
  refresh();media.addEventListener('change',refresh);window.addEventListener('beforeinstallprompt',offered);window.addEventListener('appinstalled',installed);
  return()=>{media.removeEventListener('change',refresh);window.removeEventListener('beforeinstallprompt',offered);window.removeEventListener('appinstalled',installed);};
 },[]);
 async function install(){const event=prompt.current;if(!event)return;prompt.current=null;setCanInstall(false);try{await event.prompt();const choice=await event.userChoice;setInstallStatus(choice.outcome==='accepted'?'Installation requested. Follow your browser’s confirmation.':'Installation canceled. You can still use the website.');}catch{setInstallStatus('Use your browser’s menu and the instructions below to install.');}}
 return <section id="more" className="moreSettings" aria-labelledby="more-heading">
  <div className="intro"><div><div className="eyebrow">FOURTH DOWN · YOUR SETTINGS</div><h2 id="more-heading">Your settings</h2></div><span className="badge">MADE FOR GAME DAY</span></div>
  <div className="settingsShortcuts">{resumesAvailable&&<a href="/resumes">Team Resumes & Movers <span>Confirmed results, explained →</span></a>}<a href="/following">Following <span>Manage temporary follows →</span></a><a href="#alerts">Notifications <span>Choose what matters →</span></a><a href="#notification-history">History <span>Review this device’s alerts →</span></a><a href="#install">Install Fourth Down <span>Keep it one tap away →</span></a></div>
  <AppearanceControls/><AlertSettings teams={teams}/><NotificationInbox/>
  <section id="install" className="installGuide" aria-labelledby="install-heading">
   <div className="intro"><div><div className="eyebrow">TAKE THE PLAYOFF PICTURE WITH YOU</div><h2 id="install-heading">Get the App</h2></div><span className="badge">FREE · NO APP STORE REQUIRED</span></div>
   <p className="context">Add Fourth Down to your Home Screen or desktop. It is the same live tracker, with your settings saved in the browser or installed app you use. Scores and rankings need an internet connection.</p>
   <div className="installStatus" role="status"><b>{standalone?'Installed app mode':'Installation status'}</b><p>{installStatus}</p>{canInstall&&!standalone&&<button onClick={install}>Install Fourth Down</button>}</div>
   <div className="installPlatforms">
    <article><h3>iPhone / iPad</h3><ol><li>Open <a href="https://fourth-down-cfp.vercel.app">Fourth Down</a> in Safari.</li><li>Tap Share, then Add to Home Screen. You may need to scroll through the menu.</li><li>Keep the name Fourth Down and tap Add. If offered, keep Open as Web App enabled.</li><li>Open it from the Home Screen. Enable optional notifications in More / Settings.</li></ol><p>If replacing an older shortcut, remove it and add the site again to capture the current yellow logo.</p></article>
    <article><h3>Android</h3><ol><li>Open Fourth Down in Chrome or another browser that supports installation.</li><li>Tap Install Fourth Down above when available, or open the browser menu and select Install app or Add to Home screen.</li><li>Confirm, then open Fourth Down from the Home Screen or app launcher.</li></ol><p>Menu wording and notification support vary by browser.</p></article>
    <article><h3>Desktop</h3><ol><li>Open Fourth Down in Chrome or Edge and look for the install icon in the address bar or browser menu.</li><li>On Mac Safari, choose File → Add to Dock where available.</li><li>Confirm the app name and open it from your launcher or Dock.</li></ol><p>If your browser has no install option, bookmark the site. No download is required to use the tracker.</p></article>
   </div>
  </section>

 </section>;
}
