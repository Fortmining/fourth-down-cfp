/** ESPN summary adapter. Coordinates are offense-relative yards to goal, never ball tracking. */
type Raw = Record<string, any>;
export type FieldPlay = {id:string; text:string; clock:string; period:number|null; teamId:string|null; start:number|null; end:number|null; yards:number|null; downDistance:string|null; firstDown:number|null; trace:boolean};
export type FieldBranding = {kind:'home'|'neutral'|'unknown';teamName:string|null;logo:string|null;color:string|null};
export type GameCenterData = {branding:FieldBranding;neutral:boolean|null; venue:string|null; homeTeamId:string|null; teams:{id:string;name:string;score:string;logo:string|null}[]; drives:{id:string;team:string;result:string;description:string;plays:FieldPlay[]}[]; teamStats:{teamId:string;name:string;stats:{label:string;value:string}[]}[]; playerStats:{teamId:string;groups:{name:string;labels:string[];players:{name:string;values:string[]}[]}[]}[]};
const list=(v:unknown):any[]=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v.slice(0,1200):'';
const yard=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?v:null;
export function normalizeFieldPlay(p:Raw):FieldPlay|null {
 if(!p||!str(p.id)||!str(p.text))return null;
 const start=yard(p.start?.yardsToEndzone),end=yard(p.end?.yardsToEndzone);
 const teamId=typeof p.start?.team?.id==='string'?p.start.team.id:null;
 const sameTeam=teamId!==null&&p.end?.team?.id===teamId;
 const distance=typeof p.start?.distance==='number'&&p.start.distance>=0?p.start.distance:null;
 // Administrative plays, penalties and possession changes cannot safely describe a gain trajectory.
 const consistent=typeof p.statYardage!=='number'||(start!==null&&end!==null&&Math.abs(start-end-p.statYardage)<0.01);
 const trace=consistent&&start!==null&&end!==null&&sameTeam&&p.isTurnover!==true&&p.isPenalty!==true&&!/end of|timeout|kick|punt|penalty/i.test(str(p.type?.text));
 return {id:p.id,text:str(p.text),clock:str(p.clock?.displayValue),period:Number.isInteger(p.period?.number)?p.period.number:null,teamId,start,end,
 yards:typeof p.statYardage==='number'&&Number.isFinite(p.statYardage)?p.statYardage:null,downDistance:str(p.start?.downDistanceText)||null,
 firstDown:start!==null&&distance!==null?Math.max(0,start-distance):null,trace};
}
export function normalizeGameCenter(raw:Raw):GameCenterData {
 const c=raw.header?.competitions?.[0];const previous=Array.isArray(raw.drives?.previous)?raw.drives.previous:[];
 const all=[...previous,...(raw.drives?.current?[raw.drives.current]:[])];const unique=new Map<string,Raw>();for(const d of all)if(d?.id)unique.set(String(d.id),d);
 const drives=[...unique.values()].slice(-100).map(d=>({id:String(d.id),team:str(d.team?.displayName)||'Team unavailable',result:str(d.displayResult||d.result),description:str(d.description),plays:(Array.isArray(d.plays)?d.plays:[]).map(normalizeFieldPlay).filter((p:FieldPlay|null):p is FieldPlay=>p!==null)}));
 const teamStats=list(raw.boxscore?.teams).slice(0,2).map((t:Raw)=>({teamId:String(t.team?.id||''),name:str(t.team?.displayName),stats:list(t.statistics).slice(0,40).map((s:Raw)=>({label:str(s.label||s.name),value:str(s.displayValue)||'Unavailable'}))}));
 const playerStats=list(raw.boxscore?.players).slice(0,2).map((t:Raw)=>({teamId:String(t.team?.id||''),groups:list(t.statistics).slice(0,12).map((g:Raw)=>({name:str(g.text||g.name),labels:list(g.labels).slice(0,20).map(str),players:list(g.athletes).slice(0,50).map((a:Raw)=>({name:str(a.athlete?.displayName),values:list(a.stats).slice(0,20).map(str)}))}))}));
 const teams=list(c?.competitors).slice(0,2).map(t=>{const logo=str(t.team?.logo||t.team?.logos?.[0]?.href);return {id:String(t.team?.id||''),name:str(t.team?.displayName)||'Team unavailable',score:str(t.score)||'—',logo:/^https:\/\/(?:[a-z0-9-]+\.)*espncdn\.com\//i.test(logo)?logo:null};});
 const neutral=typeof c?.neutralSite==='boolean'?c.neutralSite:null;
 const home=list(c?.competitors).filter((t:Raw)=>t?.homeAway==='home');const homeTeam=home.length===1?home[0]?.team:null;
 const verifiedHome=neutral===false&&/^[1-9]\d{0,11}$/.test(String(homeTeam?.id));
 const homeLogo=verifiedHome?teams.find(t=>t.id===String(homeTeam.id))?.logo||null:null;
 const color=verifiedHome&&/^[a-f0-9]{6}$/i.test(homeTeam?.color||'')?'#'+homeTeam.color:null;
 const branding:FieldBranding={kind:neutral===true?'neutral':verifiedHome?'home':'unknown',teamName:verifiedHome?str(homeTeam.displayName)||null:null,logo:homeLogo,color};
 return {branding,teams,neutral,venue:str(raw.gameInfo?.venue?.fullName)||null,homeTeamId:list(c?.competitors).find((t:Raw)=>t.homeAway==='home')?.team?.id||null,drives,teamStats,playerStats};
}
