/** ESPN summary adapter. Coordinates are offense-relative yards to goal, never ball tracking. */
type Raw = Record<string, any>;
export type PlayAnimation={kind:'pass'|'rush'|'punt'|'kickoff'|'field-goal'|'extra-point'|'ground';from:number;to:number;teamId:string;basis:'reported-spots'|'reported-kick-distance'|'confirmed-scoring-kick';result:string|null};
export type FieldPlay = {id:string; text:string; clock:string; period:number|null; teamId:string|null; start:number|null; end:number|null; yards:number|null; downDistance:string|null; firstDown:number|null; trace:boolean;animation?:PlayAnimation|null;kickResult?:'Good'|'Missed'|'Blocked'|null;endTeamId?:string|null;endPosition?:number|null;stoppage?:string|null;wallclock?:string|null};
export type GameSituation = {downDistance:string|null;possessionTeamId:string|null;basis:'provider'|'last-play'};
export type FieldBranding = {kind:'home'|'neutral'|'unknown';teamName:string|null;logo:string|null;color:string|null};
export type GameCenterData = {stoppage?:string|null;latestPlayAt?:string|null;ballPosition?:{teamId:string;yardsToEndzone:number;firstDown:number|null;basis:'provider'|'last-play'}|null;currentDrive?:{id:string;teamId:string;description:string;plays:number|null;yards:number|null;elapsed:string|null}|null;situation:GameSituation|null;branding:FieldBranding;neutral:boolean|null; venue:string|null; homeTeamId:string|null; teams:{id:string;name:string;score:string;logo:string|null}[]; drives:{id:string;team:string;result:string;description:string;plays:FieldPlay[]}[]; teamStats:{teamId:string;name:string;stats:{label:string;value:string}[]}[]; playerStats:{teamId:string;groups:{name:string;labels:string[];players:{name:string;values:string[]}[]}[]}[]};
const list=(v:unknown):any[]=>Array.isArray(v)?v:[];
const rows=(v:unknown):Raw[]=>list(v).filter(x=>x!==null&&typeof x==='object');
const id=(v:unknown):string|null=>/^[1-9]\d{0,11}$/.test(String(v))?String(v):null;
const numericScore=(v:unknown):string=>{const x=typeof v==='object'&&v!==null?(v as Raw).value:v;return (typeof x==='number'||(typeof x==='string'&&/^\d+$/.test(x)))&&Number.isInteger(Number(x))&&Number(x)>=0?String(Number(x)):'—';};
export function stoppageLabel(type:string,text:string):string|null {
 const value=type+' '+text;
 if(/injur(?:y|ed).*timeout|timeout.*injur/i.test(value))return 'Injury timeout';
 if(/official.*timeout|TV timeout|media timeout/i.test(value))return 'Official timeout';
 if(/timeout|time out/i.test(value))return text.trim()||'Team timeout';
 if(/review|replay official/i.test(type)||/^(?:official review|replay review|play (?:is )?under review)\b/i.test(text))return 'Replay review';
 if(/halftime|half time|end of (?:the )?(?:2nd|second) quarter|end of half/i.test(value))return 'Halftime';
 if(/end of (?:the )?(?:quarter|[1-4](?:st|nd|rd|th) quarter)|end period/i.test(value))return 'End of quarter';
 return null;
}
const administrative=(p:Raw)=>!!stoppageLabel(str(p?.type?.text),str(p?.text))||/end of|kick|punt|penalty/i.test(str(p?.type?.text));
function downText(s:Raw){const supplied=str(s?.downDistanceText)||str(s?.shortDownDistanceText);if(supplied)return supplied;return Number.isInteger(s?.down)&&s.down>=1&&s.down<=4&&typeof s?.distance==='number'&&s.distance>=0&&s.distance<=100?`${['','1st','2nd','3rd','4th'][s.down]} & ${s.distance}`:null;}

const str=(v:unknown)=>typeof v==='string'?v.slice(0,1200):'';
const yard=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?v:null;
export function normalizeFieldPlay(p:Raw):FieldPlay|null {
 if(!p||!str(p.id)||!str(p.text))return null;
 const start=yard(p.start?.yardsToEndzone),end=yard(p.end?.yardsToEndzone);
 const teamId=id(p.start?.team?.id);
 const sameTeam=teamId!==null&&id(p.end?.team?.id)===teamId;
 const distance=typeof p.start?.distance==='number'&&p.start.distance>=0&&p.start.distance<=100?p.start.distance:null;
 // Administrative plays, penalties and possession changes cannot safely describe a gain trajectory.
 const consistent=typeof p.statYardage!=='number'||(start!==null&&end!==null&&Math.abs(start-end-p.statYardage)<0.01);
 const trace=consistent&&start!==null&&end!==null&&sameTeam&&p.isTurnover!==true&&p.isPenalty!==true&&!!str(p.type?.text)&&!administrative(p);
 return {stoppage:stoppageLabel(str(p.type?.text),str(p.text)),wallclock:Number.isFinite(Date.parse(p.wallclock))?p.wallclock:null,id:p.id,text:str(p.text),clock:str(p.clock?.displayValue),period:Number.isInteger(p.period?.number)?p.period.number:null,teamId,start,end,
 yards:typeof p.statYardage==='number'&&Number.isFinite(p.statYardage)?p.statYardage:null,downDistance:downText(p.start),
 animation:normalizePlayAnimation(p,trace,start,end,teamId),kickResult:/^(Field Goal|Extra Point) Good$/i.test(str(p.type?.text))?'Good':/field goal|extra point/i.test(str(p.type?.text))?(/block/i.test(str(p.type?.text)+' '+str(p.text))?'Blocked':/miss|no good|failed/i.test(str(p.type?.text)+' '+str(p.text))?'Missed':null):null,endTeamId:id(p.end?.team?.id),endPosition:Number.isInteger(p.end?.down)&&p.end.down>=1&&p.end.down<=4?end:null,
 firstDown:!administrative(p)&&start!==null&&distance!==null?Math.max(0,start-distance):null,trace};
}

/** Arcs are decorative. Only reported spots/distances or a confirmed goal-plane crossing supply endpoints. */
function normalizePlayAnimation(p:Raw,trace:boolean,start:number|null,end:number|null,teamId:string|null):PlayAnimation|null {
 const type=str(p.type?.text),text=str(p.text);
 if(stoppageLabel(type,text)||start===null||!teamId||p.isPenalty===true||p.isTurnover===true||/\bpenalty\b/i.test(text))return null;
 const base={from:start,teamId,result:null as string|null};
 if(/^(Field Goal|Extra Point) Good$/i.test(type)){
  const fieldGoal=/^Field Goal/i.test(type),reported=text.match(/(?:attempt from|field goal from) (\d{1,3}) yards?/i);
  const distance=reported?Number(reported[1]):fieldGoal&&typeof p.statYardage==='number'?p.statYardage:null;
  // Field-goal distance includes the ten-yard end zone and the holder's setback.
  // Derive launch from reported distance only when consistent with the snap spot.
  const launch=fieldGoal&&distance!==null&&distance-10>=start&&distance-10<=start+15&&distance-10<=100?distance-10:start;
  return {...base,from:launch,to:-10,kind:fieldGoal?'field-goal':'extra-point',basis:'confirmed-scoring-kick',result:'Good'};
 }
 if(/field goal|extra point/i.test(type))return null;
 if(/punt|kickoff/i.test(type)){
  const kind=/punt/i.test(type)?'punt':'kickoff',match=text.match(kind==='punt'?/\bpunt(?:s|ed)?\s+(\d{1,3})\s+yards?\b/i:/\bkickoff\s+(\d{1,3})\s+yards?\b/i),distance=match?Number(match[1]):null;
  // Post-play end spots include returns/touchbacks and are never treated as kick landing spots.
  if(distance===null||distance<1||distance>110||start-distance < -10)return null;
  return {...base,to:start-distance,kind,basis:'reported-kick-distance',result:/touchback/i.test(text)?'Touchback':/fair catch/i.test(text)?'Fair catch':null};
 }
 if(!trace||end===null)return null;
 if(/^(Pass Reception|Passing Touchdown)$/i.test(type))return {...base,to:end,kind:'pass',basis:'reported-spots'};
 if(/pass|kick|punt/i.test(type))return null;
 return {...base,to:end,kind:/rush/i.test(type)?'rush':'ground',basis:'reported-spots'};
}

export function normalizeGameCenter(raw:Raw):GameCenterData {
 const c=raw.header?.competitions?.[0];const previous=Array.isArray(raw.drives?.previous)?raw.drives.previous:[];
 const all=[...previous,...(raw.drives?.current?[raw.drives.current]:[])];const unique=new Map<string,Raw>();for(const d of all)if(d?.id)unique.set(String(d.id),d);
 const drives=[...unique.values()].slice(-100).map(d=>({id:String(d.id),team:str(d.team?.displayName)||'Team unavailable',result:str(d.displayResult||d.result),description:str(d.description),plays:rows(d.plays).slice(-300).map(normalizeFieldPlay).filter((p:FieldPlay|null):p is FieldPlay=>p!==null)}));
 const teamStats=rows(raw.boxscore?.teams).slice(0,2).map((t:Raw)=>({teamId:String(t.team?.id||''),name:str(t.team?.displayName),stats:rows(t.statistics).slice(0,40).map((s:Raw)=>({label:str(s.label||s.name),value:str(s.displayValue)||'Unavailable'}))}));
 const playerStats=rows(raw.boxscore?.players).slice(0,2).map((t:Raw)=>({teamId:String(t.team?.id||''),groups:rows(t.statistics).slice(0,12).map((g:Raw)=>({name:str(g.text||g.name),labels:list(g.labels).slice(0,20).map(str),players:rows(g.athletes).slice(0,50).map((a:Raw)=>({name:str(a.athlete?.displayName),values:list(a.stats).slice(0,20).map(str)}))}))}));
 const teams=rows(c?.competitors).slice(0,2).map(t=>{const logo=str(t.team?.logo||t.team?.logos?.[0]?.href);return {id:id(t.team?.id)||'',name:str(t.team?.displayName)||'Team unavailable',score:numericScore(t.score),logo:/^https:\/\/(?:[a-z0-9-]+\.)*espncdn\.com\//i.test(logo)?logo:null};}).filter(t=>!!t.id);
 const neutral=typeof c?.neutralSite==='boolean'?c.neutralSite:null;
 const home=rows(c?.competitors).filter((t:Raw)=>t?.homeAway==='home');const homeTeam=home.length===1?home[0]?.team:null;
 const verifiedHome=neutral===false&&/^[1-9]\d{0,11}$/.test(String(homeTeam?.id));
 const homeLogo=verifiedHome?teams.find(t=>t.id===String(homeTeam.id))?.logo||null:null;
 const color=verifiedHome&&/^[a-f0-9]{6}$/i.test(homeTeam?.color||'')?'#'+homeTeam.color:null;
 const branding:FieldBranding={kind:neutral===true?'neutral':verifiedHome?'home':'unknown',teamName:verifiedHome?str(homeTeam.displayName)||null:null,logo:homeLogo,color};
 let situation:GameSituation|null=null;
 if((c?.status||raw.header?.status)?.type?.state==='in'){
  const source=c?.situation||raw.situation;const possession=id(source?.possession?.id||source?.possession||source?.team?.id);
  if(source&&(downText(source)||teams.some(t=>t.id===possession)))situation={downDistance:downText(source),possessionTeamId:teams.some(t=>t.id===possession)?possession:null,basis:'provider'};
  if(!situation){const last=all.flatMap(d=>rows(d?.plays)).at(-1);if(last&&normalizeFieldPlay(last)?.trace&&downText(last.end)){const endTeam=id(last.end?.team?.id);situation={downDistance:downText(last.end),possessionTeamId:teams.some(t=>t.id===endTeam)?endTeam:null,basis:'last-play'};}}
 }
 const latest=drives.flatMap(d=>d.plays).at(-1);
 const status=c?.status||raw.header?.status;
 const stoppage=stoppageLabel(str(status?.type?.name),str(status?.type?.detail))||latest?.stoppage||null;
 // A timeout/review can omit situation coordinates. Retain only the last reported
 // end spot for the same possession, never a kick/turnover's old snap spot.
 const contextPlay=all.flatMap(d=>rows(d?.plays)).filter(p=>!stoppageLabel(str(p?.type?.text),str(p?.text))).at(-1);
 if(!situation&&stoppage&&status?.type?.state==='in'&&contextPlay&&normalizeFieldPlay(contextPlay)?.trace&&downText(contextPlay.end)){
 const endTeam=id(contextPlay.end?.team?.id);if(teams.some(t=>t.id===endTeam))situation={downDistance:downText(contextPlay.end),possessionTeamId:endTeam,basis:'last-play'};
 }

 if(latest?.kickResult&&situation?.possessionTeamId===latest.teamId&&situation.downDistance===latest.downDistance)situation=null;
 let ballPosition:GameCenterData['ballPosition']=null,currentDrive:GameCenterData['currentDrive']=null;
 if(situation?.possessionTeamId){
  const teamId=situation.possessionTeamId,source=c?.situation||raw.situation,last=stoppage?contextPlay:all.flatMap(d=>rows(d?.plays)).at(-1);
  const direct=yard(source?.yardsToEndzone),lastEnd=yard(last?.end?.yardsToEndzone);
  const target=(spot:number,d:unknown)=>typeof d==='number'&&Number.isFinite(d)&&d>=0&&d<=100?Math.max(0,spot-d):null;
  if(direct!==null)ballPosition={teamId,yardsToEndzone:direct,firstDown:target(direct,source?.distance),basis:'provider'};
  else if(last&&lastEnd!==null&&id(last?.end?.team?.id)===teamId&&Number.isInteger(last?.end?.down)&&last.end.down>=1&&last.end.down<=4)ballPosition={teamId,yardsToEndzone:lastEnd,firstDown:target(lastEnd,last?.end?.distance),basis:'last-play'};
  const d=raw.drives?.current;
  if(d?.id&&id(d.team?.id)===teamId)currentDrive={id:String(d.id),teamId,description:str(d.description),plays:Number.isInteger(d.offensivePlays)&&d.offensivePlays>=0?d.offensivePlays:null,yards:typeof d.yards==='number'&&Number.isFinite(d.yards)?d.yards:null,elapsed:str(d.timeElapsed?.displayValue)||null};
 }
 return {stoppage,latestPlayAt:latest?.wallclock||null,ballPosition,currentDrive,situation,branding,teams,neutral,venue:str(raw.gameInfo?.venue?.fullName)||null,homeTeamId:rows(c?.competitors).find((t:Raw)=>t.homeAway==='home')?.team?.id||null,drives,teamStats,playerStats};
}
