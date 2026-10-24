import type {TemporaryFollow} from './alerts';
export type WatchGame={id:string;name:string;date:string;status:string;detail?:string;kickoffTbd?:boolean;completed?:boolean;providerStatus?:string;period?:number|null;clock?:number|null;teams:{id:string;name:string;score?:string}[]};
export function matchesFollow(f:TemporaryFollow,g:WatchGame){return f.duration==='game'?f.gameId===g.id:f.kind==='team'&&g.teams.some(t=>t.id===f.id);}
export function orderedWatchGames(games:WatchGame[],items:TemporaryFollow[],now:number){
 const order=(g:WatchGame)=>g.status==='in'?0:g.status==='post'?2:1;
 return games.filter(g=>items.some(f=>f.expiresAt>now&&matchesFollow(f,g))).sort((a,b)=>order(a)-order(b)||(a.status==='post'?Date.parse(b.date)-Date.parse(a.date):Date.parse(a.date)-Date.parse(b.date)));
}

export function watchClock(g:WatchGame){
 if(g.status!=='in'||!Number.isInteger(g.period)||g.period!<1||typeof g.clock!=='number'||!Number.isFinite(g.clock)||g.clock<0||g.clock>900)return '';
 return `${g.period!>4?'OT':`Q${g.period}`} · ${Math.floor(g.clock/60)}:${String(Math.floor(g.clock%60)).padStart(2,'0')}`;
}
