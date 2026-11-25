'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const destinations=[['/playoffs','Overview'],['/rankings','Official rankings'],['/scenarios#bracket','What If & bracket'],['/resumes#teams-title','Team resumes']];
export default function PlayoffNavigation(){
 const path=usePathname();
 return <nav className="playoffTabs" aria-label="Playoff analysis">{destinations.map(([href,label])=>{const route=href.split('#')[0];const active=path===route;return <Link prefetch={false} href={href} key={href} aria-current={active?'page':undefined}>{label}</Link>;})}</nav>;
}
