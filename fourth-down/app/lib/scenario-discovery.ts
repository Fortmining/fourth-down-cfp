import type {Poll, SourceId} from './rankings';
import type {SandboxCatalog} from './multi-game-sandbox';
export function scenarioPolls(polls:Poll[],now=Date.now()) {
 return polls.filter(p=>p.season===2026&&p.date&&Number.isFinite(Date.parse(p.date))&&Date.parse(p.date)<=now&&p.teams.length&&(p.status==='available'||p.status==='awaiting_update')&&(p.id!=='cfp'||now>=Date.parse('2026-11-03T19:00:00-05:00')));
}
export function preferredScenarioPoll(polls:Poll[]):SourceId|null{return (['cfp','ap','coaches'] as const).find(id=>polls.some(p=>p.id===id))??null;}
export function discoverScenarioGames(c:SandboxCatalog,poll:Poll|undefined,rankedOnly:boolean,search:string,excluded:string[]=[],now=Date.now()) {
 const ranks=new Map(poll?.teams.map(t=>[t.teamId,t.rank])??[]),q=search.trim().toLowerCase();
 return c.games.filter(g=>Date.parse(g.date)>now&&!excluded.includes(g.id)&&(!rankedOnly||g.teams.some(t=>ranks.has(t.id)))&&g.teams.some(t=>t.name.toLowerCase().includes(q)));
}
export function scenarioSourceAfterRefresh(polls:Poll[],previous:SourceId|null,manual:boolean):SourceId|null{return manual&&polls.some(p=>p.id===previous)?previous:preferredScenarioPoll(polls);}
export function teamScenarioGames(c:SandboxCatalog,games:SandboxCatalog['games'],teamId:string,scope:'team'|'opponents'|'all'){
 if(!teamId||scope==='all')return games;
 const team=c.teams.find(t=>t.id===teamId);if(!team)return [];
 if(scope==='team')return games.filter(g=>g.teams.some(t=>t.id===teamId));
 const opponents=new Set(c.teams.filter(t=>t.id!==teamId&&(team.wins.some(id=>t.losses.includes(id))||team.losses.some(id=>t.wins.includes(id)))).map(t=>t.id));
 for(const g of c.games.filter(g=>g.teams.some(t=>t.id===teamId)))for(const t of g.teams)if(t.id!==teamId)opponents.add(t.id);
 return games.filter(g=>!g.teams.some(t=>t.id===teamId)&&g.teams.some(t=>opponents.has(t.id)));
}
export function winsOutPlan(c:SandboxCatalog,choices:{gameId:string;winnerId:string}[],teamId:string,excluded:string[]=[],now=Date.now()){
 if(!c.teams.some(t=>t.id===teamId))return {games:0,choices:[] as typeof choices,reason:'A verified team baseline is required.'};
 if(choices.length>16||new Set(choices.map(p=>p.gameId)).size!==choices.length)return {games:0,choices:[] as typeof choices,reason:'Refresh invalid or duplicate selections first.'};
 if(choices.some(p=>{const g=c.games.find(g=>g.id===p.gameId);return !g||excluded.includes(g.id)||Date.parse(g.date)<=now||!g.teams.some(t=>t.id===p.winnerId);}))return {games:0,choices:[] as typeof choices,reason:'Refresh unavailable selections first.'};
 const games=c.games.filter(g=>g.teams.some(t=>t.id===teamId)&&Date.parse(g.date)>now&&!excluded.includes(g.id)),ids=new Set(games.map(g=>g.id));
 const next=[...choices.filter(p=>!ids.has(p.gameId)),...games.map(g=>({gameId:g.id,winnerId:teamId}))].sort((a,b)=>a.gameId.localeCompare(b.gameId));
 return {games:games.length,choices:next,reason:!games.length?'No verified remaining games are available.':next.length>16?'Remove other picks first: wins out would exceed the 16-game limit.':''};
}
