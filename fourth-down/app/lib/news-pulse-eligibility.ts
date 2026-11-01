import {newsSources,newsIsStale,type NewsAudience,type NewsItem} from './news-pulse.ts';
import {newsCardLink} from './news-pulse-media.ts';
import {inNewsQuietHours,type NewsPreferences} from './news-pulse-preferences.ts';
type Usage={teamHour:number;teamDay:number;nationalHour:number;nationalDay:number};
// Evaluation only. No sender, subscription access, ledger mutation or queue exists.
export function evaluateNewsAlert(item:NewsItem,prefs:NewsPreferences,audience:NewsAudience,now:number,sent:ReadonlySet<string>,usage:Usage,optInAt:number|null=null){
 const result=(reason:string,eligible=false,identity:string|null=null,scopes:string[]=[])=>({eligible,deliveryEnabled:false as const,reason,identity,scopes});
 const source=newsSources.find(s=>s.id===item.sourceId),classification=item.classification;
 if(!source||!newsCardLink(item,source,now)||item.fixture||item.state==='retracted'||item.state==='conflicted'||!classification?.evidence)return result('No verified alert classification');
 if(!item.publishedAt||newsIsStale(item,now)||Date.parse(item.publishedAt)>now||now-Date.parse(item.publishedAt)>2*3600000)return result('Missing, future or stale publication time');
 if(inNewsQuietHours(prefs,now))return result('Quiet hours or invalid preferences');
 if(optInAt===null||!Number.isFinite(optInAt)||optInAt>Date.parse(item.publishedAt)||Object.values(usage).some(n=>!Number.isFinite(n)||n<0))return result('Missing or late opt-in evidence / invalid budget state');
 const key='pulse:story:'+(item.verifiedStoryKey||new URL(item.url).origin+new URL(item.url).pathname+new URL(item.url).search);
 if(sent.has(key))return result('Already claimed',false,key);
 const category=classification.category,scopes:string[]=[];
 if(category!=='major'){
  if(audience.favorites.some(t=>item.teamIds.includes(t.id))&&prefs.favorites[category])scopes.push('permanent-favorite');
  if((audience.following?.items||[]).some(f=>f.createdAt<=Date.parse(item.publishedAt!)&&f.expiresAt>now&&((f.kind==='team'&&item.teamIds.includes(f.id))||(f.kind==='game'&&item.gameId===f.gameId)))&&prefs.temporary[category])scopes.push('temporary-follow');
 }
 if(scopes.length&&(usage.teamHour>=prefs.limits.perHour||usage.teamDay>=prefs.limits.perDay))return result('Team budget reached',false,key);
 if(category==='major'&&item.national&&prefs.national){if(usage.nationalHour>=prefs.nationalLimits.perHour||usage.nationalDay>=prefs.nationalLimits.perDay)return result('National budget reached',false,key);scopes.push('national');}
 return result(scopes.length?'Eligible for a future explicitly enabled sender':'No opted-in matching audience',scopes.length>0,key,scopes);
}
