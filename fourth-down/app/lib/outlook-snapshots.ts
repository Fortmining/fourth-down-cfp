import {tierFor} from './model.ts';
import type {AlertFeed} from './alerts';
export type OutlookSnapshot={schema:1;modelVersion:'poll-position-v1';predictive:false;season:number;edition:string;source:'AP';generatedAt:number;id:string;teams:{id:string;name:string;rank:number;tier:string}[]};
export const MODEL_LIMITATION='Fourth Down currently groups poll positions; it does not forecast CFP selection, automatic bids or probabilities. Playoff Shakeup and Bubble Movement notifications are unavailable until a validated selection model exists.';
export function outlookSnapshot(feed:AlertFeed,now=Date.now()):OutlookSnapshot|null{
 const at=Date.parse(feed.updatedAt),p=feed.polls.find(p=>p.id==='ap');
 if(!Number.isInteger(feed.season)||!Number.isFinite(at)||at>now+30000||now-at>90000||!p||p.status!=='available'||p.season!==feed.season||!p.date||!Number.isFinite(Date.parse(p.date))||Date.parse(p.date)>now||now-Date.parse(p.date)>8*86400000||p.teams.length!==25||new Set(p.teams.map(t=>t.rank)).size!==25||new Set(p.teams.map(t=>t.teamId)).size!==25||!p.teams.every(t=>/^\d{1,12}$/.test(t.teamId)&&Number.isInteger(t.rank)&&t.rank>=1&&t.rank<=25))return null;
 return {schema:1,modelVersion:'poll-position-v1',predictive:false,season:feed.season!,edition:p.date,source:'AP',generatedAt:now,id:`poll-position-v1:${feed.season}:${p.date}`,teams:p.teams.map(t=>({id:t.teamId,name:t.name,rank:t.rank,tier:tierFor(t.rank).name})).sort((a,b)=>a.rank-b.rank)};
}
export function compareOutlooks(previous:OutlookSnapshot|null,current:OutlookSnapshot){
 const comparable=!!previous&&previous.modelVersion===current.modelVersion&&previous.season===current.season&&Date.parse(current.edition)>Date.parse(previous.edition)&&current.generatedAt-previous.generatedAt<=8*86400000;
 return {notificationsSupported:false as const,reason:MODEL_LIMITATION,comparable,changes:comparable?current.teams.flatMap(t=>{const old=previous!.teams.find(x=>x.id===t.id);return old&&old.tier!==t.tier?[{id:t.id,name:t.name,from:old.rank,to:t.rank,reason:`Published AP rank changed from ${old.rank} to ${t.rank}; poll-position tier changed. This is not a CFP field prediction.`}]:[]}):[]};
}
