"use client";
import { useEffect,useState } from 'react';
import { Home,Radio,Trophy,Menu,ListChecks } from 'lucide-react';
const destinations=[{label:'Home',href:'#content',Icon:Home},{label:'Games',href:'#scores',Icon:Radio},{label:'Watchlist',href:'#watchlist',Icon:ListChecks},{label:'Playoff',href:'#outlook',Icon:Trophy},{label:'More',href:'#more',Icon:Menu}];
export default function TrackerNavigation({mobile=false,detail=false,contentReady=true}:{mobile?:boolean;detail?:boolean;contentReady?:boolean}) {
 const [hash,setHash]=useState('#content');
 useEffect(()=>{const changed=()=>setHash(location.hash||'#content');changed();window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
 // Re-anchor once the first live snapshot has expanded the page. Later refreshes
 // keep the reader's position because contentReady stays true.
 useEffect(()=>{if(detail||!contentReady||!location.hash)return;const frame=requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant',block:'start'}));return()=>cancelAnimationFrame(frame);},[contentReady,detail]);
 const selected=['#alerts','#install','#following'].includes(hash)?'#more':hash;
 return <nav className={mobile?'mobileTrackerNav':'desktopTrackerNav'} aria-label={mobile?'Mobile tracker navigation':'Tracker sections'}>{destinations.map(({label,href,Icon})=><a key={href} href={detail?`/${href}`:href} onClick={event=>{if(detail||!contentReady||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const target=document.getElementById(href.slice(1));if(!target)return;event.preventDefault();if(location.hash!==href){history.pushState(null,'',href);window.dispatchEvent(new HashChangeEvent('hashchange'));}target.scrollIntoView({behavior:'instant',block:'start'});}} aria-current={!detail&&selected===href?'location':undefined}>{mobile&&<Icon size={19}/>}<span>{label}</span></a>)}</nav>;
}
