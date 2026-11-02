export const NEWS_PREFS_KEY='fourth-down-news-pulse-draft-v1';
export const newsCategories=['breaking','highlights','routine','recaps'] as const;
export type NewsChoices=Record<typeof newsCategories[number],boolean>;
export type NewsPlan='quiet'|'balanced'|'allIn';
export type NewsPreferences={version:2;plan:NewsPlan;favorites:NewsChoices;temporary:NewsChoices;national:boolean;quiet:{enabled:boolean;timeZone:string;start:string;end:string};limits:{perHour:number;perDay:number};nationalLimits:{perHour:number;perDay:number}};
export const newsPlans:Record<NewsPlan,{label:string;limits:NewsPreferences['limits'];nationalLimits:NewsPreferences['limits']}>= {
 quiet:{label:'Quiet',limits:{perHour:1,perDay:3},nationalLimits:{perHour:1,perDay:1}},
 balanced:{label:'Balanced',limits:{perHour:3,perDay:12},nationalLimits:{perHour:1,perDay:3}},
 allIn:{label:'All In',limits:{perHour:6,perDay:30},nationalLimits:{perHour:2,perDay:6}},
};
export function validTimeZone(zone:string){try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();return zone.length<=100;}catch{return false;}}
export function defaultNewsPreferences(timeZone='UTC'):NewsPreferences {
 const choices={breaking:true,highlights:true,routine:false,recaps:false};
 return {version:2,plan:'balanced',favorites:{...choices},temporary:{...choices},national:true,quiet:{enabled:false,timeZone:validTimeZone(timeZone)?timeZone:'UTC',start:'22:00',end:'08:00'},limits:{...newsPlans.balanced.limits},nationalLimits:{...newsPlans.balanced.nationalLimits}};
}
const clock=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function validateNewsPreferences(input:unknown):NewsPreferences|null {
 const raw=input as Omit<NewsPreferences,'version'>&{version:number};if(!raw||![1,2].includes(raw.version))return null;
 // Preserve every saved v1 choice and budget; do not silently apply Balanced.
 const p:NewsPreferences=raw.version===1?{...raw,version:2,plan:'balanced',nationalLimits:{perHour:1,perDay:1}} as NewsPreferences:raw as NewsPreferences;
 if(!p.favorites||!p.temporary||newsCategories.some(k=>typeof p.favorites[k]!=='boolean'||typeof p.temporary[k]!=='boolean')||typeof p.national!=='boolean'||!['quiet','balanced','allIn'].includes(p.plan))return null;
 if(!p.quiet||typeof p.quiet.enabled!=='boolean'||typeof p.quiet.timeZone!=='string'||!validTimeZone(p.quiet.timeZone)||!clock(p.quiet.start)||!clock(p.quiet.end)||(p.quiet.enabled&&p.quiet.start===p.quiet.end))return null;
 const limits=(v:NewsPreferences['limits']|undefined,h:number,d:number)=>!!v&&Number.isInteger(v.perHour)&&Number.isInteger(v.perDay)&&v.perHour>=1&&v.perHour<=h&&v.perDay>=1&&v.perDay<=d&&v.perHour<=v.perDay;
 if(!limits(p.limits,12,60)||!limits(p.nationalLimits,4,12))return null;
 return {version:2,plan:p.plan,favorites:{...p.favorites},temporary:{...p.temporary},national:p.national,quiet:{...p.quiet},limits:{...p.limits},nationalLimits:{...p.nationalLimits}};
}
export function applyNewsPlan(plan:NewsPlan,previous:NewsPreferences){return {...previous,plan,limits:{...newsPlans[plan].limits},nationalLimits:{...newsPlans[plan].nationalLimits}};}
export function newsPlanSelection(p:NewsPreferences):NewsPlan|'custom'{return (Object.keys(newsPlans) as NewsPlan[]).find(k=>newsPlans[k].limits.perDay===p.limits.perDay&&newsPlans[k].limits.perHour===p.limits.perHour&&newsPlans[k].nationalLimits.perDay===p.nationalLimits.perDay&&newsPlans[k].nationalLimits.perHour===p.nationalLimits.perHour)||'custom';}
export function timeZoneLabel(zone:string){try{const label=new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'longGeneric'}).formatToParts().find(p=>p.type==='timeZoneName')?.value;return `${label||zone} — ${zone.replaceAll('_',' ')}`;}catch{return zone;}}
export function timeZoneOptions(detected:string,current:string){let all:string[]=[];try{all=Intl.supportedValuesOf('timeZone');}catch{}return [...new Set([detected,current,'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','Pacific/Honolulu','Europe/London','UTC',...all])].filter(validTimeZone);}
export function inNewsQuietHours(p:NewsPreferences,now:number){
 if(!Number.isFinite(now)||!validateNewsPreferences(p))return true;
 if(!p.quiet.enabled)return false;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:p.quiet.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const local=parts.find(x=>x.type==='hour')!.value+':'+parts.find(x=>x.type==='minute')!.value;
 const {start,end}=p.quiet;return start<end?local>=start&&local<end:local>=start||local<end;
}
export function newsPushEnabled():false{return false;}
