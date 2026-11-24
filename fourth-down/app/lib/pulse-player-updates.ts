import type {FootballEvent} from './pulse-events.ts';
import type {NewsAudience} from './news-pulse.ts';

export const PLAYER_UPDATE_DAYS=30;
const DAY=86400000;

export function followedPlayerTeams(audience:NewsAudience,now:number):ReadonlySet<string>{
 return new Set([
  ...audience.favorites.map(team=>team.id),
  ...(audience.following?.items||[]).filter(follow=>follow.kind==='team'&&follow.createdAt<=now&&follow.expiresAt>now).map(follow=>follow.id),
 ]);
}

export function matchesPlayerTeam(event:FootballEvent,ids:ReadonlySet<string>){
 return ids.has(event.school.id)||Boolean(event.from&&ids.has(event.from.id));
}

export function playerUpdateTimeline(events:readonly FootballEvent[],now:number){
 const today=new Date(now).toISOString().slice(0,10);
 const cutoff=new Date(Date.parse(today+'T00:00:00Z')-(PLAYER_UPDATE_DAYS-1)*DAY).toISOString().slice(0,10);
 const recent:FootballEvent[]=[],history:FootballEvent[]=[];
 for(const event of events){
  if(event.status!=='active'||event.eventDate>today)continue;
  // A new observation, revision or roster season cannot change an event's age.
  // Month-only evidence cannot establish a recent day and stays in record history.
  if(event.precision==='day'&&event.eventDate>=cutoff)recent.push(event);
  else history.push(event);
 }
 const newest=(a:FootballEvent,b:FootballEvent)=>b.eventDate.localeCompare(a.eventDate)||a.player.name.localeCompare(b.player.name);
 return {recent:recent.sort(newest),history:history.sort(newest),cutoff,today};
}
