"use client";
import { useEffect,useState } from 'react';
import { Home,Radio,Trophy,Menu } from 'lucide-react';
const destinations=[{label:'Home',href:'#content',Icon:Home},{label:'Games',href:'#scores',Icon:Radio},{label:'Playoff',href:'#outlook',Icon:Trophy},{label:'More',href:'#more',Icon:Menu}];
export default function TrackerNavigation({mobile=false}:{mobile?:boolean}) {
 const [hash,setHash]=useState('#content');
 useEffect(()=>{const changed=()=>setHash(location.hash||'#content');changed();window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
 const selected=['#alerts','#install'].includes(hash)?'#more':hash;
 return <nav className={mobile?'mobileTrackerNav':'desktopTrackerNav'} aria-label={mobile?'Mobile tracker navigation':'Tracker sections'}>{destinations.map(({label,href,Icon})=><a key={href} href={href} aria-current={selected===href?'location':undefined}>{mobile&&<Icon size={19}/>}<span>{label}</span></a>)}</nav>;
}
