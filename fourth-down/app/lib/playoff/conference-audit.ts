import {resolveConference} from './conference.ts';
import {resolvePac12} from './pac12.ts';
import {validFinal,mergeLedger} from './ledger.ts';
import {championshipSlots,isPac12FlexGame,scheduleAudit} from './schedule.ts';
import type {Inputs} from './types';

/** Read-only private integration: no route, scheduler, Redis client or synthetic champion. */
export function conferenceQualificationAudit(input:Inputs) {
  const games=mergeLedger([],input.games),schedule=scheduleAudit(input);
  const complete=(conference:string)=>{
    const ids=new Set(input.teams.filter(t=>t.conference===conference).map(t=>t.id));
    const relevant=games.filter(g=>g.season===2026&&g.conferenceGame&&g.teams.every(id=>ids.has(id))&&
      !championshipSlots[g.id]&&!isPac12FlexGame(g.season,g.date,conference,conference,g.id));
    const cutoff=conference==='9'?'2026-11-22T08:00Z':'2026-11-29T08:00Z';
    return input.season===2026&&input.coverage.complete&&schedule.unclassified===0&&
      Date.parse(input.observedAt)>=Date.parse(cutoff)&&ids.size>1&&
      relevant.length>0&&relevant.every(g=>validFinal(g,Date.parse(input.observedAt)))&&
      [...ids].every(id=>relevant.some(g=>g.teams.includes(id)))&&
      // Pac-12's published seven-game round robin must be complete. Cancelled
      // games require conference evidence, not an inferred missing-game exception.
      (conference!=='9'||(ids.size===8&&[...ids].every(id=>new Set(relevant.filter(g=>g.teams.includes(id)).flatMap(g=>g.teams.filter(o=>o!==id))).size===7)));
  };
  return {
    shadow:true,publicActivation:false,observation:input.observedAt,
    powerFour:[
      resolveConference(input,'1','acc-2026',{regularSeasonComplete:complete('1')}),
      resolveConference(input,'4','big12-current',{regularSeasonComplete:complete('4')}),
      resolveConference(input,'5','bigten-2026-top-records',{regularSeasonComplete:complete('5')}),
      resolveConference(input,'8','sec-current',{regularSeasonComplete:complete('8')}),
    ],
    pac12:resolvePac12(input,{conferenceSeasonComplete:complete('9')}),
    limitation:'No conference result or eligibility is inferred. Official external tiebreaker metrics are not substituted with model values. Other conference adapters remain unavailable.',
  };
}
