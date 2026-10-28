import type {Feed,Game} from './tracker-types';
import type {AlertPreferences} from './alerts';
import type {SharedResumeDisplay} from './playoff/resume-pipeline';
import {matchesFollow} from './watchlist.ts';
export type GameScope='top25'|'following'|'conference'|'all';
export function safeTeamLogo(value:unknown){try{if(typeof value!=='string')return undefined;const url=new URL(value);return url.protocol==='https:'&&/^(?:a[1-4]?|secure)\.espncdn\.com$/.test(url.hostname)?url.href:undefined;}catch{return undefined;}}
export function teamArtwork(feed:Feed|null){const map:Record<string,string>={};for(const t of [...(feed?.polls.flatMap(p=>p.teams.map(t=>({id:t.teamId,logo:t.logo})))||[]),...(feed?.games.flatMap(g=>g.teams)||[])]){const logo=safeTeamLogo(t.logo);if(logo)map[t.id]=logo;}return map;}
export function conferenceMap(feed:Feed|null,packet:SharedResumeDisplay|null){const result:Record<string,string>={};for(const t of feed?.polls.flatMap(p=>p.teams)||[])if(t.conference&&!/unavailable|unknown|^Conference(?: \d|$)/i.test(t.conference))result[t.teamId]=t.conference;for(const row of packet?.view?.rows||[])if(row.conference&&!/^Conference \d|unavailable|unknown/i.test(row.conference))result[row.id]=row.conference;return result;}
export function calendarWeek(date:string){const d=new Date(date);if(!Number.isFinite(d.getTime()))return '';const at=new Date(d.getFullYear(),d.getMonth(),d.getDate());at.setDate(at.getDate()-((at.getDay()+6)%7));return localDay(at);}
export function localDay(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function selectGames(games:Game[],options:{scope:GameScope;apIds:string[];preferences:AlertPreferences;conferences:Record<string,string>;conference:string;week:string;day:string;status:string;query:string;now:number}){const o=options;return games.filter(g=>
 (!o.week||calendarWeek(g.date)===o.week)&&(!o.day||localDay(new Date(g.date))===o.day)&&(o.status==='all'||g.status===o.status)&&g.teams.some(t=>t.name.toLowerCase().includes(o.query.trim().toLowerCase()))&&
 (o.scope==='all'||o.scope==='top25'&&g.teams.some(t=>o.apIds.includes(t.id))||o.scope==='conference'&&g.teams.some(t=>o.conferences[t.id]===o.conference)||o.scope==='following'&&(g.teams.some(t=>o.preferences.favorites.some(f=>f.id===t.id))||o.preferences.following?.items.some(f=>f.expiresAt>o.now&&matchesFollow(f,g)))))
 .sort((a,b)=>({in:0,pre:1,post:2}[a.status as 'in']??3)-({in:0,pre:1,post:2}[b.status as 'in']??3)||Date.parse(a.date)-Date.parse(b.date));}
export function retryableFollowSave(pending:boolean,hasControl:boolean,stage:string|undefined){return pending&&hasControl&&['worker-save-failed','server-save-failed'].includes(stage||'');}
export function strongestWin<T extends {opponentStrength:number|null}>(wins:T[]){return [...wins].filter(w=>typeof w.opponentStrength==='number'&&Number.isFinite(w.opponentStrength)).sort((a,b)=>b.opponentStrength!-a.opponentStrength!)[0];}
