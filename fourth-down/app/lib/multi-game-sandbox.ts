import {gameScenarios,type ScenarioBaseline} from './game-scenarios.ts';
export function sandboxCatalog(view:ScenarioBaseline,now=Date.now()){
 const ids=[...new Set(view.rows.flatMap(r=>r.remaining.map(g=>g.gameId)))];const games=ids.flatMap(id=>{const p=gameScenarios(view,id,now);return p.status==='available'&&Date.parse(p.date)>now?[{id,date:p.date,kickoffTbd:(view.rows.find(r=>r.id===p.teams[0].id)?.remaining.find(g=>g.gameId===id) as {kickoffTbd?:boolean}|undefined)?.kickoffTbd!==false,conferenceGame:p.conferenceGame,teams:p.teams.map(t=>({id:t.id,name:t.name}))}]:[];}).sort((a,b)=>a.date.localeCompare(b.date));
 return {at:view.at,snapshotId:view.snapshotId,teams:view.rows.map(r=>({id:r.id,name:r.name,overall:validOverall(r),conferenceRecord:validConference(validOverall(r),r.conferenceRecord),wins:r.wins.map(g=>g.gameId),losses:r.losses.map(g=>g.gameId)})),games};
}
export type SandboxCatalog=ReturnType<typeof sandboxCatalog>;
export function evaluateSandbox(c:SandboxCatalog,choices:{gameId:string;winnerId:string}[],excluded:string[]=[]){
 if(choices.length>16||new Set(choices.map(x=>x.gameId)).size!==choices.length)throw Error('Choose up to 16 distinct games.');
 const games=[...choices].sort((a,b)=>a.gameId.localeCompare(b.gameId)).map(x=>{const g=c.games.find(g=>g.id===x.gameId);if(!g||excluded.includes(g.id)||!g.teams.some(t=>t.id===x.winnerId))throw Error('A selected fixture is no longer available. Refresh your scenario.');return {...g,winnerId:x.winnerId};});
 const rows=c.teams.map(t=>{const rec=t.overall?.match(/^(\d+)-(\d+)$/),conf=t.conferenceRecord?.match(/^(\d+)-(\d+)$/);const own=games.filter(g=>g.teams.some(p=>p.id===t.id)),wins=own.filter(g=>g.winnerId===t.id).length,cg=own.filter(g=>g.conferenceGame),cw=cg.filter(g=>g.winnerId===t.id).length;return {...t,before:t.overall,after:rec?`${+rec[1]+wins}-${+rec[2]+own.length-wins}`:null,conferenceAfter:conf?`${+conf[1]+cw}-${+conf[2]+cg.length-cw}`:null,selectedResults:own.map(g=>({gameId:g.id,outcome:g.winnerId===t.id?'Win':'Loss'}))};});
 return rows.map(t=>{const peers=rows.filter(p=>p.id!==t.id&&p.selectedResults.length&&(t.wins.some(id=>p.losses.includes(id))||t.losses.some(id=>p.wins.includes(id))));return {...t,opponentChanges:peers.map(p=>{const beat=t.wins.some(id=>p.losses.includes(id)),lostTo=t.losses.some(id=>p.wins.includes(id));return {id:p.id,name:p.name,before:p.before,after:p.after,beat,lostTo,direction:opponentDirection(p.before,p.after)};}),affected:t.selectedResults.length>0||peers.length>0};}).filter(t=>t.affected).sort((a,b)=>Number(b.selectedResults.length>0)-Number(a.selectedResults.length>0)||a.name.localeCompare(b.name));
}

function validConference(overall:string|null,conference:string|null){const a=overall?.match(/^(\d+)-(\d+)$/),b=conference?.match(/^(\d+)-(\d+)$/);return a&&b&&+b[1]<=+a[1]&&+b[2]<=+a[2]?conference:null;}

function validOverall(r:ScenarioBaseline['rows'][number]){const a=r.overall?.match(/^(\d+)-(\d+)$/);return a&&+a[1]===r.wins.length&&+a[2]===r.losses.length&&new Set([...r.wins,...r.losses].map(g=>g.gameId)).size===r.wins.length+r.losses.length?r.overall:null;}

function opponentDirection(before:string|null,after:string|null){if(!before||!after)return 'mixed';const [bw,bl]=before.split('-').map(Number),[aw,al]=after.split('-').map(Number);if(!bw&&!bl)return 'mixed';const delta=aw*(bw+bl)-bw*(aw+al);return delta>0?'stronger':delta<0?'weaker':'mixed';}
