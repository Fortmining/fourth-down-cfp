export const eventKinds = ['recruit-commitment','recruit-decommitment','signing','flip','portal-entry','portal-withdrawal','transfer-commitment','arrival','availability','roster-movement'] as const;
export type EventKind = typeof eventKinds[number];
export type FootballEvent = {
  id: string;
  player: {id:string; name:string; position:string};
  school: {id:string; name:string};
  from?: {id:string; name:string};
  season: number;
  kind: EventKind;
  eventDate: string;
  precision: 'day'|'month';
  status: 'active'|'retracted';
  revision: number;
  source: {publisher:string; url:string; verification:'official'|'reported'; observedOn:string};
};

export function ingestFootballEvents(previous:readonly FootballEvent[], batch:readonly FootballEvent[]) {
  const records = new Map(previous.map(row=>[`${row.id}:${row.revision}`,row]));
  for (const row of batch) {
    const url = new URL(row.source.url);
    const date = Date.parse(row.eventDate);
    if (url.protocol !== 'https:' || url.username || url.password || !eventKinds.includes(row.kind) ||
        !row.player.id || !row.school.id || !Number.isSafeInteger(row.revision) || row.revision < 1 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.eventDate) || !Number.isFinite(date) ||
        new Date(date).toISOString().slice(0,10)!==row.eventDate) throw Error('Invalid football event');
    const key = `${row.id}:${row.revision}`;
    const old = records.get(key);
    if (old && JSON.stringify(old)!==JSON.stringify(row)) throw Error('Conflicting event revision');
    records.set(key,row);
  }
  return [...records.values()].sort((a,b)=>a.id.localeCompare(b.id)||a.revision-b.revision);
}

export function currentFootballEvents(history:readonly FootballEvent[]) {
  const latest = new Map<string,FootballEvent>();
  for (const row of history) if ((latest.get(row.id)?.revision||0)<row.revision) latest.set(row.id,row);
  return [...latest.values()].filter(row=>row.status==='active').sort((a,b)=>b.eventDate.localeCompare(a.eventDate)||a.player.name.localeCompare(b.player.name));
}

// Private planning only. The future sender must persist this key per device
// before delivery. Corrections and retractions must never repeat an alert.
export function planPlayerUpdateAlerts(
  history:readonly FootballEvent[],
  teamActiveSince:ReadonlyMap<string,string>,
  enabled:ReadonlySet<EventKind>,
  after:string,
  through:string,
  alreadyPlanned:ReadonlySet<string>,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(after)||!/^\d{4}-\d{2}-\d{2}$/.test(through)||after>=through) return [];
  return currentFootballEvents(history).flatMap(row=>{
    if (row.revision!==1||row.precision!=='day'||
        row.source.verification!=='official'||!enabled.has(row.kind)||row.eventDate<=after||row.eventDate>through) return [];
    const follows=[row.school.id,row.from?.id].some(id=>{
      const since=id ? teamActiveSince.get(id) : undefined;
      return since!==undefined&&since<row.eventDate;
    });
    const key='pulse-player:'+row.id;
    return follows&&!alreadyPlanned.has(key)?[{key,event:row}]:[];
  });
}
