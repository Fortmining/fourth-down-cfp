import {playoffGames,resolveSlot,type BracketPicks} from './bracket-predictor.ts';
import type {Game} from './tracker-types';
export type OfficialField={season:number;publishedAt:string|null;verifiedAt:string|null;sourceUrl:string|null;teams:{id:string;name:string;seed:number;record?:string;logo?:string}[];gameIds:Record<string,string>};
/** A weekly poll is never accepted as the Selection Day field. This reviewed source manifest
 * stays empty until the CFP publishes the actual field and provider game IDs are reconciled.
 */
export function verifiedOfficialField(field:OfficialField,now=Date.now()){
 try{const url=new URL(field.sourceUrl||'');return field.season===2026&&url.protocol==='https:'&&url.hostname.replace(/^www\./,'')==='collegefootballplayoff.com'&&!url.username&&!url.password&&Date.parse(field.publishedAt||'')>=Date.parse('2026-12-06T00:00:00Z')&&Date.parse(field.publishedAt||'')<=Date.parse(field.verifiedAt||'')&&Date.parse(field.verifiedAt||'')<=now&&field.teams.length===12&&new Set(field.teams.map(t=>t.id)).size===12&&new Set(field.teams.map(t=>t.seed)).size===12&&field.teams.every(t=>/^\d+$/.test(t.id)&&t.name&&Number.isInteger(t.seed)&&t.seed>=1&&t.seed<=12)&&Object.entries(field.gameIds).every(([round,id])=>playoffGames.some(g=>g.id===round)&&/^\d{1,12}$/.test(id))&&new Set(Object.values(field.gameIds)).size===Object.keys(field.gameIds).length;}catch{return false;}
}
export function officialAdvancement(field:OfficialField,games:Game[],now=Date.now()):BracketPicks{
 if(!verifiedOfficialField(field,now))return {};
 const seeds=Array.from({length:12},(_,i)=>field.teams.find(t=>t.seed===i+1)!.id),picks:BracketPicks={};
 for(const round of playoffGames){const matches=games.filter(g=>g.id===field.gameIds[round.id]);if(matches.length!==1)continue;const game=matches[0],a=resolveSlot(round.a,seeds,picks),b=resolveSlot(round.b,seeds,picks);
  if(!a||!b||a===b||game.status!=='post'||game.completed!==true||!/^STATUS_FINAL(?:_OT)?$/.test(game.providerStatus||'')||!Number.isFinite(Date.parse(game.date))||Date.parse(game.date)>now||Date.parse(game.date)<Date.parse(field.publishedAt!)||game.teams.length!==2||!game.teams.every(t=>[a,b].includes(t.id)&&typeof t.score==='string'&&/^\d{1,3}$/.test(t.score))||new Set(game.teams.map(t=>t.id)).size!==2)continue;
  const [x,y]=game.teams;if(Number(x.score)===Number(y.score))continue;const winner=Number(x.score)>Number(y.score)?x:y,loser=winner===x?y:x;
  if(winner.winner!==true||loser.winner===true)continue;picks[round.id]=winner.id;
 }
 return picks;
}
