'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
const destinations=[['/playoffs','Overview'],['/rankings','Official rankings'],['/scenarios#bracket','Bracket lab'],['/scenarios#scenario-editor','What if?'],['/resumes#teams-title','Team resumes']];
export default function PlayoffNavigation(){
 const path=usePathname(),[hash,setHash]=useState('');
 useEffect(()=>{const read=()=>setHash(location.hash);read();window.addEventListener('hashchange',read);window.addEventListener('popstate',read);return()=>{window.removeEventListener('hashchange',read);window.removeEventListener('popstate',read);};},[path]);
 return <nav className="playoffTabs" aria-label="Playoff analysis">{destinations.map(([href,label])=>{const [route,anchor]=href.split('#');const active=path===route&&(route!=='/scenarios'||(hash||'#scenario-editor')==='#'+anchor);return <Link prefetch={false} href={href} key={href} onClick={()=>setHash(anchor?'#'+anchor:'')} aria-current={active?'page':undefined}>{label}</Link>;})}</nav>;
}
