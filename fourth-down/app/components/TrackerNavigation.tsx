"use client";
import {usePathname} from 'next/navigation';import {Home,Radio,Trophy,Menu,ListChecks} from 'lucide-react';
const primary=[{label:'Home',href:'/',Icon:Home},{label:'Games',href:'/games',Icon:Radio},{label:'Playoffs',href:'/playoffs',Icon:Trophy},{label:'Following',href:'/following',Icon:ListChecks},{label:'More',href:'/more',Icon:Menu}];
const desktop=[primary[0],primary[1],{label:'Rankings',href:'/rankings',Icon:Trophy},primary[2],{label:'Resume Center',href:'/resumes',Icon:ListChecks},primary[3],{label:'Settings',href:'/settings',Icon:Menu}];
export default function TrackerNavigation({mobile=false}:{mobile?:boolean;detail?:boolean;contentReady?:boolean}){
 const path=usePathname();return <nav className={mobile?'mobileTrackerNav':'desktopTrackerNav'} aria-label={mobile?'Mobile tracker navigation':'Tracker sections'}>{(mobile?primary:desktop).map(({label,href,Icon})=>{const active=href==='/'?path==='/':href==='/more'?['/more','/rankings','/resumes','/settings','/about'].includes(path):path===href;return <a href={href} key={href} aria-current={active?'page':undefined}>{mobile&&<Icon size={19}/>}<span>{label}</span></a>;})}</nav>;
}
