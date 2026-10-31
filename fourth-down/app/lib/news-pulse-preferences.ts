export const NEWS_PREFS_KEY='fourth-down-news-pulse-draft-v1';
export const newsCategories=['breaking','highlights','routine','recaps'] as const;
export type NewsChoices=Record<typeof newsCategories[number],boolean>;
export type NewsPreferences={version:1;favorites:NewsChoices;temporary:NewsChoices;national:boolean;quiet:{enabled:boolean;timeZone:string;start:string;end:string};limits:{perHour:number;perDay:number}};
export function defaultNewsPreferences():NewsPreferences {
  const choices={breaking:true,highlights:true,routine:false,recaps:false};
  return {version:1,favorites:{...choices},temporary:{...choices},national:true,quiet:{enabled:false,timeZone:'UTC',start:'22:00',end:'08:00'},limits:{perHour:2,perDay:6}};
}
export function validTimeZone(zone:string){try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();return zone.length<=100;}catch{return false;}}
const clock=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function validateNewsPreferences(input:unknown):NewsPreferences|null {
  const p=input as NewsPreferences|null;
  if(!p||p.version!==1||!p.favorites||!p.temporary||newsCategories.some(k=>typeof p.favorites[k]!=='boolean'||typeof p.temporary[k]!=='boolean')||typeof p.national!=='boolean')return null;
  if(!p.quiet||typeof p.quiet.enabled!=='boolean'||typeof p.quiet.timeZone!=='string'||!validTimeZone(p.quiet.timeZone)||!clock(p.quiet.start)||!clock(p.quiet.end)||(p.quiet.enabled&&p.quiet.start===p.quiet.end))return null;
  if(!p.limits||!Number.isInteger(p.limits.perHour)||!Number.isInteger(p.limits.perDay)||p.limits.perHour<1||p.limits.perHour>2||p.limits.perDay<1||p.limits.perDay>6||p.limits.perHour>p.limits.perDay)return null;
  return {version:1,favorites:{...p.favorites},temporary:{...p.temporary},national:p.national,quiet:{enabled:p.quiet.enabled,timeZone:p.quiet.timeZone,start:p.quiet.start,end:p.quiet.end},limits:{perHour:p.limits.perHour,perDay:p.limits.perDay}};
}
export function inNewsQuietHours(p:NewsPreferences,now:number){
  if(!Number.isFinite(now)||!validateNewsPreferences(p))return true; // Fail closed for a future delivery gate.
  if(!p.quiet.enabled)return false;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:p.quiet.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const local=parts.find(x=>x.type==='hour')!.value+':'+parts.find(x=>x.type==='minute')!.value;
  const {start,end}=p.quiet;return start<end?local>=start&&local<end:local>=start||local<end;
}
// This pilot has no alert outbox, sender, permission prompt or subscription update.
export function newsPushEnabled():false{return false;}
