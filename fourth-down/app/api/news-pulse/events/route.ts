import {NextResponse} from 'next/server';
import {unstable_cache} from 'next/cache';
import {footballEventHistory} from '../../../lib/pulse-official-events';
import {currentFootballEvents,ingestFootballEvents} from '../../../lib/pulse-events';
import {readRosterArrival,rosterSources} from '../../../lib/pulse-roster-source';

const cachedSources=rosterSources.map(source=>({
  source,
  read:unstable_cache(()=>readRosterArrival(source),['pulse-roster-arrival-v1',source.path],{revalidate:3600}),
}));

export async function GET() {
  const results=await Promise.allSettled(cachedSources.map(entry=>entry.read()));
  const automatic=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
  const history=ingestFootballEvents(footballEventHistory,automatic);
  const coverage=results.map((result,index)=>({
    playerId:cachedSources[index].source.player.id,
    status:result.status==='fulfilled'?'checked':'unavailable',
    ...(result.status==='fulfilled'?{observedOn:result.value.source.observedOn}:{}),
  }));
  return NextResponse.json({events:currentFootballEvents(history),history,coverage},{
    headers:{'Cache-Control':'public, s-maxage=600'},
  });
}
