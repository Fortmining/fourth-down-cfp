import {currentFootballEvents,ingestFootballEvents,type FootballEvent} from './pulse-events.ts';

const school = {id:'2633',name:'Tennessee'};
const signingSource = 'https://utsports.com/news/2025/12/4/football-rockytop26-vols-surge-on-national-signing-day-for-best-class-of-heupel-era';
const signees = [
  ['faizon-brandon','Faizon Brandon','QB'],
  ['tk-keys','TK Keys','WR'],
  ['gabriel-osenda','Gabriel Osenda','OL'],
] as const;
const arrivals = [
  ['ryan-staub','Ryan Staub','QB','38','Colorado','ryan--staub-/23091'],
  ['javin-gordon','Javin Gordon','RB','2655','Tulane','javin-gordon/23071'],
  ['dejuan-lane','Dejuan Lane','DB','213','Penn State','dejuan--lane-/23078'],
  ['kayin-lee','Kayin Lee','DB','2','Auburn','kayin--lee-/23079'],
] as const;

const provenance = {publisher:'Tennessee Athletics',verification:'official',observedOn:'2026-11-23'} as const;
const common = {school,season:2026,status:'active',revision:1} as const;
const reviewed: FootballEvent[] = [
  ...signees.map(([id,name,position])=>({...common,id:`2026:2633:signing:${id}`,player:{id,name,position},kind:'signing' as const,eventDate:'2025-12-03',precision:'day' as const,source:{...provenance,url:signingSource}})),
  ...arrivals.map(([id,name,position,fromId,fromName,slug])=>({...common,id:`2026:2633:arrival:${id}`,player:{id,name,position},from:{id:fromId,name:fromName},kind:'arrival' as const,eventDate:'2026-01-01',precision:'month' as const,source:{...provenance,url:`https://utsports.com/sports/football/roster/${slug}`}})),
];

export const footballEventHistory = ingestFootballEvents([],reviewed);
export const officialFootballEvents = currentFootballEvents(footballEventHistory);
