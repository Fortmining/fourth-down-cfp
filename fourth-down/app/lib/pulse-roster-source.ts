import type {FootballEvent} from './pulse-events.ts';

export const rosterSources = [
  {player:{id:'xavier-gilliam',name:'Xavier Gilliam',position:'DL'},from:{id:'213',name:'Penn State'},path:'xavier-gilliam/23068'},
  {player:{id:'amare-campbell',name:'Amare Campbell',position:'LB'},from:{id:'213',name:'Penn State'},path:'amare-campbell/23060'},
] as const;

export async function readRosterArrival(source:typeof rosterSources[number], fetcher=fetch):Promise<FootballEvent> {
  const url = `https://utsports.com/sports/football/roster/${source.path}`;
  const response = await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(6000)});
  if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/html')) throw Error('Roster source unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '', bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 4_000_000) throw Error('Roster source too large');
      html += decoder.decode(chunk.value,{stream:true});
    }
  } finally { await reader.cancel(); }
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (!title?.startsWith(source.player.name+' - Football') ||
      !/enrolled at Tennessee in January 2026/i.test(html) ||
      !html.includes(source.from.name)) throw Error('Enrollment evidence unavailable');
  return {
    id:`2026:2633:arrival:${source.player.id}`,player:source.player,from:source.from,
    school:{id:'2633',name:'Tennessee'},season:2026,kind:'arrival',
    eventDate:'2026-01-01',precision:'month',status:'active',revision:1,
    source:{publisher:'Tennessee Athletics',url,verification:'official',observedOn:new Date().toISOString().slice(0,10)},
  };
}
