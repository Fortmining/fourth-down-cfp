import { mergeLedger, validFinal } from './ledger.ts';
import { championshipSlots, isPac12FlexGame, PAC12_RULE_SOURCE } from './schedule.ts';
import type { Edition, Inputs } from './types';

type Options = {
  conferenceSeasonComplete: boolean;
  cfpWeek13?: { edition: Edition; source: string };
  sportSource?: { asOf: string; source: string; metric: 'team-rating'; direction: 'higher' | 'lower'; values: Record<string, number> };
};

/** Private 2026 adapter. Qualification and host order are distinct from CFP seeding. */
export function resolvePac12(input: Inputs, options: Options) {
  const issues: string[] = [];
  const trace: {step: string; ids: string[]}[] = [];
  const at = Date.parse(input.observedAt);
  const members = input.teams.filter(t => t.conference === '9');
  const memberIds = new Set(members.map(t => t.id));
  if (input.season !== 2026 || !Number.isFinite(at)) issues.push('Pac-12 adapter requires a valid 2026 observation');
  if (!options.conferenceSeasonComplete || !input.coverage.complete) issues.push('Conference season not confirmed complete');
  if (members.some(t => t.eligible === null)) issues.push('Postseason eligibility unresolved');
  const scheduled = mergeLedger([], input.games).filter(g => g.season === input.season && g.conferenceGame &&
    g.teams.every(id => memberIds.has(id)) && !championshipSlots[g.id] &&
    !isPac12FlexGame(g.season,g.date,'9','9',g.id));
  if (scheduled.some(g => !validFinal(g,at))) issues.push('Unfinished or invalid conference result');
  const finals = scheduled.filter(g => validFinal(g,at));
  const games = (id: string) => finals.filter(g => g.teams.includes(id));
  const opponents = (id: string) => new Set(games(id).flatMap(g => g.teams.filter(o => o !== id)));
  const record = (id: string, against?: Set<string>) => {
    const gs = games(id).filter(g => !against || g.teams.some(o => o !== id && against.has(o)));
    return {wins: gs.filter(g => g.winner === id).length, played: gs.length};
  };
  const pct = (id: string, against?: Set<string>) => { const r=record(id,against); return r.played?r.wins/r.played:null; };
  const standings = members.map(t => ({id:t.id,eligible:t.eligible,...record(t.id),pct:pct(t.id)}));
  const common = (ids:string[]) => ids.reduce((s,id)=>new Set([...s].filter(o=>opponents(id).has(o))),opponents(ids[0]));
  const values = (ids:string[],f:(id:string)=>number|null) => Object.fromEntries(ids.map(id=>[id,f(id)]));
  const narrow = (ids:string[], scores:Record<string,number|null>, step:string) => {
    if (ids.some(id=>scores[id]===null||!Number.isFinite(scores[id]))) { issues.push('Missing evidence: '+step); return []; }
    const best=Math.max(...ids.map(id=>scores[id]!));
    const kept=ids.filter(id=>Math.abs(scores[id]!-best)<1e-12);
    trace.push({step,ids:kept});return kept;
  };
  const highestCommon = (ids:string[]) => {
    const shared=common(ids),groups=new Map<number,string[]>();
    for (const row of standings) if (row.pct!==null) groups.set(row.pct,[...(groups.get(row.pct)||[]),row.id]);
    for (const [,group] of [...groups].sort((a,b)=>b[0]-a[0])) {
      const against=new Set(group.filter(id=>shared.has(id)));
      if (!against.size) continue;
      const kept=narrow(ids,values(ids,id=>pct(id,against)),'next-highest common opponent group');
      if (kept.length!==ids.length) return kept;
    }
    return ids;
  };
  const officialRating = (ids:string[]) => {
    const e=options.sportSource;
    if (!e || e.metric!=='team-rating' || !/^https:\/\//.test(e.source) ||
      !Number.isFinite(Date.parse(e.asOf)) || Date.parse(e.asOf)>at ||
      Date.parse(e.asOf)<Math.max(...finals.map(g=>Date.parse(g.date))) ||
      !['higher','lower'].includes(e.direction) || ids.some(id=>!Number.isFinite(e.values[id]))) {
      issues.push('Official post-conference SportSource team-rating unavailable');return [];
    }
    return narrow(ids,values(ids,id=>e.direction==='lower'?-e.values[id]:e.values[id]),'SportSource team-rating');
  };
  const cfp = (ids:string[]) => {
    const e=options.cfpWeek13;
    const edition=e?.edition;
    const date=edition&&Date.parse(edition.date);
    const localDay=date&&Number.isFinite(date)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):null;
    const ranks=edition?.ranks||[];
    if (!e || !/^https:\/\/(www\.)?collegefootballplayoff\.com\//.test(e.source) ||
      edition?.id!=='cfp'||edition.season!==2026||!date||date>at||localDay!=='2026-11-24'||
      ranks.length!==25||new Set(ranks.map(r=>r.id)).size!==25||new Set(ranks.map(r=>r.rank)).size!==25||
      ranks.some(r=>!Number.isInteger(r.rank)||r.rank<1||r.rank>25)) {
      issues.push('Verified Tuesday-before-week-13 CFP edition unavailable');return [];
    }
    return narrow(ids,values(ids,id=>-(ranks.find(r=>r.id===id)?.rank??26)),'week-13 Tuesday CFP rank');
  };
  function tie(ids:string[]):string[] {
    if (ids.length<=1) return ids;
    if (ids.length===2) {
      let kept=ids;
      const head=finals.filter(g=>g.teams.every(id=>ids.includes(id)));
      if (head.length) {kept=narrow(ids,values(ids,id=>pct(id,new Set(ids))),'two-team head-to-head');if(kept.length!==ids.length)return kept;}
      // The two-team order deliberately differs from the multi-team order.
      kept=highestCommon(ids);if(kept.length!==ids.length)return kept;
      const shared=common(ids);
      if(shared.size){kept=narrow(ids,values(ids,id=>pct(id,shared)),'all common conference opponents');if(kept.length!==ids.length)return kept;}
      kept=cfp(ids);if(kept.length!==ids.length)return kept;
      kept=officialRating(ids);if(kept.length!==ids.length)return kept;
      issues.push('Conference-administered draw unresolved; never synthesize coin toss');return [];
    }
    let kept=ids;
    const complete=ids.every(id=>ids.every(o=>o===id||finals.some(g=>g.teams.includes(id)&&g.teams.includes(o))));
    if(complete){kept=narrow(ids,values(ids,id=>pct(id,new Set(ids))),'multi-team head-to-head');if(kept.length<=2)return kept.length===2?tie(kept):kept;}
    const shared=common(kept);
    if(shared.size){kept=narrow(kept,values(kept,id=>pct(id,shared)),'all common conference opponents');if(kept.length<=2)return kept.length===2?tie(kept):kept;}
    kept=highestCommon(kept);if(kept.length<=2)return kept.length===2?tie(kept):kept;
    kept=narrow(kept,values(kept,id=>{
      const rs=[...opponents(id)].map(o=>record(o)),n=rs.reduce((n,r)=>n+r.played,0);
      return n?rs.reduce((n,r)=>n+r.wins,0)/n:null;
    }),'combined conference opponent winning percentage');
    if(kept.length<=2)return kept.length===2?tie(kept):kept;
    kept=officialRating(kept);if(kept.length<=2)return kept.length===2?tie(kept):kept;
    issues.push('Conference-administered draw unresolved; never synthesize coin toss');return [];
  }
  const seeds:string[]=[];
  if(!issues.length){
    let pool=standings.filter(t=>t.eligible===true&&t.played>0).map(t=>t.id);
    while(seeds.length<2&&pool.length){
      const best=Math.max(...pool.map(id=>pct(id)!));
      const group=pool.filter(id=>pct(id)===best);
      const chosen=tie(group);
      if(chosen.length!==1)break;
      seeds.push(chosen[0]);pool=pool.filter(id=>id!==chosen[0]);
    }
  }
  if(seeds.length!==2)issues.push('Championship participants and host not fully resolved');
  return {policy:'pac12-2026',source:PAC12_RULE_SOURCE,standings,trace,issues:[...new Set(issues)],
    participants:issues.length?[]:seeds,host:issues.length?null:seeds[0],definitive:false,shadow:true};
}
