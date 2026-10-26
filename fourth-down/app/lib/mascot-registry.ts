import registry from '../data/mascots-2026.json' with { type: 'json' };

export type MascotEntry = {
  espnId: string; school: string; season: number; division: string;
  status: string; names: string[]; sources: string[]; verifiedAt: string | null;
};
const entries: readonly MascotEntry[] = registry.entries;
const byId = new Map(entries.map(entry => [entry.espnId, entry]));
// Require both ESPN identity and its full school label. Never join another provider's IDs.
const identity = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function mascotForTeam(id: string, school: string, season = 2026): string {
  const entry = byId.get(id);
  if (!entry || entry.season !== season || identity(entry.school) !== identity(school)) return 'Not available';
  const supported = entry.sources.length > 0 && entry.sources.every(source => source.startsWith('https://')) && !!entry.verifiedAt;
  if (!supported) return 'Not available';
  if (entry.status === 'none' && entry.names.length === 0) return 'No official mascot';
  if (entry.status !== 'verified' || !entry.names.length) return 'Not available';
  return entry.names.join(' / ');
}
export function mascotCoverage() {
  return { total: entries.length, verified: entries.filter(e => e.status === 'verified').length,
    none: entries.filter(e => e.status === 'none').length,
    unresolved: entries.filter(e => e.status === 'unresolved').length,
    duplicateIds: entries.map(e => e.espnId).filter((id, index, ids) => ids.indexOf(id) !== index) };
}
