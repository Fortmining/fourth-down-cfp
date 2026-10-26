import type { Poll } from './rankings';
import type { CurrentRecord } from './playoff/record-view';

export const TEAM_SEASON = 2026;
// ESPN 2026 FBS group labels; membership comes from each team's supplied group ID.
const conferenceNames: Record<string,string> = {'151':'American Conference','1':'ACC','4':'Big 12','5':'Big Ten','12':'Conference USA','18':'FBS Independents','15':'MAC','17':'Mountain West','9':'Pac-12','8':'SEC','37':'Sun Belt'};
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';
export const validTeamId = (id: string) => /^[1-9]\d{0,11}$/.test(id);
export type TeamGame = {
  id: string; name: string; date: string; status: string; providerStatus: string;
  completed: boolean; detail: string; period: number | null; clock: number | null;
  kickoffTbd: boolean; neutralSite: boolean; broadcast: string; venue: string;
  conferenceGame: boolean;
  teams: {id: string; name: string; logo?: string; score?: string; homeAway?: string; winner?: boolean}[];
};
export type TeamStat = {id: string; label: string; value: string | null; espnRank: string | null; basis: string};
export type TeamDetail = {
  id: string; name: string; nickname: string | null; mascot: string | null; logo: string | null; conference: string | null;
  standing: string | null; reportedRecord: string | null; statisticsGames: number | null; record: CurrentRecord | null; season: number;
  games: TeamGame[]; scheduleAvailable: boolean; polls: Poll[]; stats: TeamStat[];
  warnings: string[]; observedAt: string; sources: {label: string; url: string; observedAt: string}[];
};
type Raw = any;
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const image = (v: unknown) => typeof v === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)*espncdn\.com\//i.test(v) ? v : undefined;
const score = (v: Raw) => {
  const n = typeof v === 'object' && v !== null ? v.value : v;
  return n !== null && n !== undefined && n !== '' && Number.isInteger(Number(n)) && Number(n) >= 0 ? String(n) : undefined;
};
export function normalizeTeamGame(e: Raw, teamId?: string): TeamGame | null {
  const c = e?.competitions?.[0], s = e?.status || c?.status;
  const teams = c?.competitors;
  if (!validTeamId(String(e?.id)) || !Number.isFinite(Date.parse(e?.date || c?.date)) ||
      !Array.isArray(teams) || teams.length !== 2 || !['pre','in','post'].includes(s?.type?.state)) return null;
  const normalized = teams.map((t: Raw) => ({id: String(t.team?.id || t.id), name: text(t.team?.displayName) || text(t.team?.name) || 'Team unavailable',
    logo: image(t.team?.logo || t.team?.logos?.[0]?.href), score: score(t.score), homeAway: t.homeAway, winner: t.winner === true}));
  if (normalized.some(t => !validTeamId(t.id)) || normalized[0].id === normalized[1].id || (teamId && !normalized.some(t => t.id === teamId))) return null;
  const completed = s.type.state === 'post' && s.type.completed === true &&
    normalized.every(t => t.score !== undefined) && normalized[0].score !== normalized[1].score && Date.parse(e.date || c.date) <= Date.now() && /^STATUS_FINAL/.test(s.type.name || '');
  return {id: String(e.id), name: text(e.name) || normalized.map(t=>t.name).join(' vs. '), date: e.date || c.date,
    status: s.type.state, providerStatus: s.type.name || '', completed,
    detail: text(s.type.shortDetail) || text(s.type.description) || 'Status unavailable',
    period: Number.isInteger(s.period) ? s.period : null, clock: numeric(s.clock) ? s.clock : null,
    kickoffTbd: e.timeValid === false || c.timeValid === false || /TBD|TBA/i.test(s.type.detail || ''),
    neutralSite: c.neutralSite === true, venue: text(c.venue?.fullName) || '', conferenceGame: c.conferenceCompetition === true,
    broadcast: [...new Set((c.broadcasts || []).flatMap((b: Raw) => b.names || [b.media?.shortName]).filter((v: unknown)=>text(v)))].join(' · '), teams: normalized};
}
export function scheduleGames(raw: Raw, id: string, type: number) {
  if (raw?.season?.year !== TEAM_SEASON || String(raw.team?.id) !== id || !Array.isArray(raw.events)) throw Error('Wrong-season or invalid schedule');
  // Future postseason can legitimately return an empty regular-season envelope.
  if (raw.events.length && raw.season.type !== type) throw Error('Wrong schedule period');
  const games = raw.events.map((e: Raw) => {
    if (e.season?.year !== TEAM_SEASON) throw Error('Wrong event season');
    const game = normalizeTeamGame(e,id); if (!game) throw Error('Incomplete schedule entry'); return game;
  });
  return games as TeamGame[];
}
export function mergeTeamGames(schedule: TeamGame[], current: TeamGame[], id: string) {
  const map = new Map(schedule.map(g=>[g.id,g]));
  for (const g of current.filter(g=>g.teams.some(t=>t.id===id))) {
    const old = map.get(g.id);
    // Do not erase an already verified Final on a transient pre/live regression.
    if (old?.completed && !g.completed) continue;
    map.set(g.id,old ? {...old,...g,neutralSite:old.neutralSite,venue:g.venue||old.venue,broadcast:g.broadcast||old.broadcast} : g);
  }
  return [...map.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id));
}
export function gameResult(g: TeamGame, id: string) {
  if (!g.completed) return null;
  const t = g.teams.find(t=>t.id===id), other = g.teams.find(t=>t.id!==id);
  return t?.score !== undefined && other?.score !== undefined ? Number(t.score)>Number(other.score)?'W':'L' : null;
}
export function teamStatistics(raw: Raw): TeamStat[] {
  // Core statistics are league-wide ESPN ranks; their FBS/FCS scope is not supplied.
  const valid = raw && /\/seasons\/2026(?:[/?]|$)/.test(raw.season?.$ref || '') && /\/types\/2(?:[/?]|$)/.test(raw.seasonType?.$ref || '');
  const categories = valid && Array.isArray(raw.splits?.categories) ? raw.splits.categories : [];
  const get = (cat: string, name: string) => {const c=categories.find((c:Raw)=>c?.name===cat);return Array.isArray(c?.stats)?c.stats.find((s:Raw)=>s?.name===name&&numeric(s.value)):undefined;};
  const row = (id: string,label: string,cat: string,name: string): TeamStat => {const s=get(cat,name);return {id,label,value:s?(text(s.displayValue)||String(s.value)):null,espnRank:s&&Number.isInteger(s.rank)&&s.rank>0?(text(s.rankDisplayValue)||String(s.rank)):null,basis:'ESPN 2026 regular season'};};
  const result = [row('pointsFor','Points scored / game','scoring','totalPointsPerGame'),row('pointsAgainst','Points allowed / game','defensive','pointsAllowedPerGame'),
    row('yards','Total offense yards / game','passing','yardsPerGame'),row('passing','Passing yards / game','passing','passingYardsPerGame'),row('rushing','Rushing yards / game','rushing','rushingYardsPerGame'),
    row('allowedYards','Yards allowed / game','defensive','yardsAllowedPerGame'),row('sacks','Defensive sacks','defensive','sacks'),row('tackles','Defensive tackles','defensive','totalTackles'),
    row('interceptions','Defensive interceptions','defensiveInterceptions','interceptions'),row('turnovers','Turnover margin','miscellaneous','turnOverDifferential')];
  return result;
}
export function statisticsGames(raw: Raw): number | null {
 if(!/\/seasons\/2026(?:[/?]|$)/.test(raw?.season?.$ref || ''))return null;
 const categories=Array.isArray(raw?.splits?.categories)?raw.splits.categories:[];
 const general=categories.find((c:Raw)=>c?.name==='general');
 const stat=Array.isArray(general?.stats)?general.stats.find((s:Raw)=>s?.name==='gamesPlayed'):undefined;
 return Number.isInteger(stat?.value)&&stat.value>=0?stat.value:null;
}
export async function espnTeamSource(url: string, revalidate: number) {
  const r=await fetch(url,{next:{revalidate},signal:AbortSignal.timeout(6000)});
  if (!r.ok) throw Error('ESPN source unavailable');
  return r.json();
}
export async function loadTeamDetail(id: string, read=espnTeamSource): Promise<TeamDetail> {
  if (!validTeamId(id)) throw Error('Invalid team identifier');
  const urls=[`${BASE}/teams/${id}`,`${BASE}/teams/${id}/schedule?season=2026&seasontype=2`,`${BASE}/teams/${id}/schedule?season=2026&seasontype=3`,
    `https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2026/types/2/teams/${id}/statistics`];
  const results=await Promise.allSettled(urls.map((u,i)=>read(u,i===3?300:60)));
  const value=(i:number)=>results[i].status==='fulfilled'?results[i].value:null;
  const profile=value(0)?.team;
  if (!profile || String(profile.id)!==id || !text(profile.displayName)) throw Error('Team unavailable');
  const observedAt=new Date().toISOString(),warnings:string[]=[],games:TeamGame[]=[];
  let scheduleAvailable=true;
  for(const i of [1,2])try{games.push(...scheduleGames(value(i),id,i===1?2:3));}catch{scheduleAvailable=false;warnings.push(`${i===1?'Regular-season':'Postseason'} schedule unavailable or incomplete. No missing fixtures have been invented.`);}
  const stats=value(3);
  if (!stats || !new RegExp(`/teams/${id}(?:[/?]|$)`).test(String(stats.team?.$ref))) warnings.push('Team statistics unavailable.');
  const usableStats=stats&&new RegExp(`/teams/${id}(?:[/?]|$)`).test(String(stats.team?.$ref))?stats:null;
  const normalizedStats=teamStatistics(usableStats);
  if(normalizedStats.every(s=>s.value===null)&&!warnings.includes('Team statistics unavailable.'))warnings.push('Team statistics unavailable.');
  return {id,name:profile.displayName,nickname:text(profile.name),mascot:text(profile.mascot?.name),logo:image(profile.logos?.[0]?.href)||null,
    conference:conferenceNames[String(profile.groups?.id)]||null,standing:text(profile.standingSummary),reportedRecord:text(Array.isArray(profile.record?.items)?profile.record.items.find((r:Raw)=>r?.type==='total')?.summary:null),statisticsGames:statisticsGames(usableStats),record:null,season:TEAM_SEASON,
    games:mergeTeamGames(games,[],id),scheduleAvailable,polls:[],stats:normalizedStats,warnings,observedAt,
    sources:urls.flatMap((url,i)=>results[i].status==='fulfilled'?[{label:['Team overview','Regular season schedule','Postseason schedule','Team statistics'][i],url,observedAt}]:[])};
}

/** Join the same confirmed record map used elsewhere, never a poll snapshot. */
export function applyTeamContext(data: TeamDetail, feed: Raw): TeamDetail {
 const f=feed?.season===TEAM_SEASON?feed:null;
 const record=f?.currentRecords?.[data.id]||null;
 const polls=(f?.polls||[]).filter((p:Poll)=>p.season===TEAM_SEASON);
 const warnings=[...data.warnings];
 if(!f)warnings.push('Current records and published rankings are unavailable.');
 if(record?.status!=='available')warnings.push('Current records could not be reconciled.');
 const stats=data.stats.map(s=>({...s}));
 const finals=data.games.filter(g=>g.completed);
 const count=record?.status==='available'&&/^\d+-\d+(?:-\d+)?$/.test(record.overall)?record.overall.split('-').reduce((a:number,v:string)=>a+Number(v),0):null;
 // A partial schedule must never produce a purported season average.
 if(data.scheduleAvailable&&count!==null&&count>0&&finals.length===count){
  const allowed=finals.reduce((n,g)=>n+Number(g.teams.find(t=>t.id!==data.id)!.score),0);
  const row=stats.find(s=>s.id==='pointsAgainst');
  if(row){row.value=(allowed/count).toFixed(1);row.espnRank=null;row.basis=`Calculated from ${count} verified ESPN final scores`;}
 }
 return {...data,record,polls,stats,warnings,standing:record?.status==='available'&&data.reportedRecord===record.overall?data.standing:null,conference:data.conference||polls.flatMap((p:Poll)=>p.teams).find((t:{teamId:string})=>t.teamId===data.id)?.conference||null};
}
