'use client';
import {safeTeamLogo} from '../lib/fan-view';
export default function TeamMark({name,logo}:{name:string;logo?:string}){const src=safeTeamLogo(logo);return <span className="fanTeamMark" aria-hidden="true">{name.slice(0,1)}{src&&<img src={src} alt="" width="44" height="44" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>;}
