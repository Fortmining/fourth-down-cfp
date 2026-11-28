import {newsReasons,type NewsItem,type NewsAudience} from './news-pulse.ts';
import {matchesPulseDesk} from './pulse-desks.ts';
export const pulseFeedTabs=[['latest','Latest'],['following','Following'],['recruiting','Recruiting'],['portal','Transfer Portal']] as const;
export type PulseFeedTab=typeof pulseFeedTabs[number][0];
export type PulseFeedState={tab:PulseFeedTab;team:string;conference:string;kind:string;division:string;older:boolean;limit:number};
export const defaultPulseFeed:PulseFeedState={tab:'latest',team:'',conference:'',kind:'all',division:'all',older:false,limit:30};
export function readPulseFeedState(query:string,saved?:Partial<PulseFeedState>):PulseFeedState{
 const q=new URLSearchParams(query),tab=q.get('feed')||q.get('desk')||(q.get('view')==='for-you'?'following':!q.has('team')&&!q.has('view')?saved?.tab:'latest');
 return {tab:pulseFeedTabs.some(([id])=>id===tab)?tab as PulseFeedTab:q.get('view')==='for-you'?'following':'latest',team:/^\d{1,12}$/.test(q.get('team')||saved?.team||'')?(q.get('team')??saved?.team??''):'',conference:(q.get('conference')??saved?.conference??'').slice(0,80),kind:['news','highlight'].includes(q.get('kind')||saved?.kind||'')?(q.get('kind')||saved?.kind)!:'all',division:['fbs','fcs'].includes(q.get('view')||saved?.division||'')?(q.get('view')||saved?.division)!:'all',older:q.has('older')?q.get('older')==='1':saved?.older===true,limit:Math.max(30,Math.min(1000,Number(saved?.limit)||30))};
}
export function pulseFeedItems(items:NewsItem[],audience:NewsAudience,now:number,state:PulseFeedState){
 return items.filter(i=>{
  if(state.team&&!i.teamIds.includes(state.team)||state.conference&&!i.conferenceIds?.includes(state.conference))return false;
  if(state.division==='fcs'&&i.competition!=='fcs'||state.division==='fbs'&&i.competition==='fcs')return false;
  if(state.kind==='news'&&['video','highlight'].includes(i.kind)||state.kind==='highlight'&&!['video','highlight'].includes(i.kind))return false;
  if(state.tab==='following')return newsReasons(i,audience,now).some(r=>!r.startsWith('Conference coverage:'));
  if(state.tab==='recruiting')return matchesPulseDesk(i,'recruiting')||matchesPulseDesk(i,'signing');
  if(state.tab==='portal')return matchesPulseDesk(i,'portal')||/\btransfers?|transferring\b/i.test(i.title);
  return true;
 }).sort((a,b)=>Date.parse(b.publishedAt||b.publishedDate||b.updatedAt)-Date.parse(a.publishedAt||a.publishedDate||a.updatedAt));
}
export function pulseRelativeTime(published:string|null,now:number){
 if(!published)return 'Date unavailable';const ms=now-Date.parse(published);if(!Number.isFinite(ms)||ms<0)return 'Just now';
 const min=Math.floor(ms/60000);if(min<1)return 'Just now';if(min<60)return min+'m ago';const hours=Math.floor(min/60);if(hours<24)return hours+'h ago';const days=Math.floor(hours/24);return days<7?days+'d ago':new Date(published).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'});
}
