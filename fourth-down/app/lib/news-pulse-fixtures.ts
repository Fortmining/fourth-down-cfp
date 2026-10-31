import {newsSources,normalizeNews,reconcileNews,type Candidate,type NewsPacket,type MatchTeam} from './news-pulse.ts';
export const NEWS_SCENARIO_AT='2026-10-30T18:00:00Z';
const teams:MatchTeam[]=[{id:'2633',name:'Tennessee Volunteers',aliases:['Tennessee Volunteers']},{id:'2634',name:'Tennessee State Tigers',aliases:['Tennessee State Tigers']}];
// Synthetic UI scenarios, NOT publisher stories. Each link opens the verified
// official channel; no fabricated article URLs, clip IDs or live timestamps.
export function newsFixturePacket():NewsPacket {
  const common={sourceId:'tennessee-youtube',url:newsSources[0].home,football:true,fixture:true};
  const candidates:Candidate[]=[
    {...common,id:'sample-highlight',title:'Sample: Tennessee Volunteers play highlight',kind:'highlight',publishedAt:'2026-10-30T17:45:00Z',updatedAt:'2026-10-30T17:45:00Z',national:true},
    {...common,id:'sample-news',title:'Sample: Tennessee Volunteers football announcement',kind:'news',publishedAt:'2026-10-30T17:00:00Z',updatedAt:'2026-10-30T17:00:00Z'},
    {...common,id:'sample-correction',title:'Sample: Tennessee Volunteers announcement — corrected details',kind:'news',publishedAt:'2026-10-30T16:00:00Z',updatedAt:'2026-10-30T17:30:00Z',state:'corrected'},
    {...common,id:'sample-national',title:'Sample: national college football discussion',kind:'analysis',publishedAt:'2026-10-30T15:00:00Z',updatedAt:'2026-10-30T15:00:00Z',national:true},
    {...common,id:'sample-older',title:'Sample: Tennessee Volunteers postgame recap',kind:'recap',publishedAt:'2026-10-28T15:00:00Z',updatedAt:'2026-10-28T15:00:00Z'},
    {...common,id:'sample-undated',title:'Sample: football video without a publication time',kind:'highlight',publishedAt:null,updatedAt:'2026-10-30T14:00:00Z',national:true},
    {...common,id:'sample-retracted',title:'Sample: withdrawn football item',kind:'news',publishedAt:'2026-10-30T13:00:00Z',updatedAt:'2026-10-30T17:00:00Z',state:'retracted'},
  ];
  return {version:1,mode:'fixtures',evaluatedAt:NEWS_SCENARIO_AT,items:reconcileNews([],candidates.flatMap(c=>{const n=normalizeNews(c,teams,[],Date.parse(NEWS_SCENARIO_AT),true);return n?[n]:[];})),sources:newsSources,pushDelivery:false};
}
