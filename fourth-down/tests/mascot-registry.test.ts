import {test} from 'node:test';
import assert from 'node:assert/strict';
import registry from '../app/data/mascots-2026.json' with {type:'json'};
import {mascotForTeam,mascotCoverage} from '../app/lib/mascot-registry.ts';
test('division inventory has unique ESPN identities and complete explicit resolution states',()=>{
 const coverage=mascotCoverage();assert.equal(coverage.total,266);assert.deepEqual(coverage.duplicateIds,[]);
 assert.equal(registry.entries.filter(e=>e.division==='fbs').length,138);
 assert.equal(registry.entries.filter(e=>e.division==='fcs').length,128);
 for(const e of registry.entries){assert.ok(['verified','none','unresolved'].includes(e.status));assert.equal(e.season,2026);
 if(e.status==='verified'){assert.ok(e.names.length);assert.ok(e.sources.length);assert.ok(e.verifiedAt);}
 else if(e.status==='unresolved'){assert.deepEqual(e.names,[]);assert.equal(mascotForTeam(e.espnId,e.school),'Not available');}}
});
test('Tennessee uses actual mascot, never Volunteers nickname',()=>{const e=registry.entries.find(e=>e.espnId==='2633')!;assert.equal(mascotForTeam(e.espnId,e.school),'Smokey');});
test('multiple mascots and FCS identities are supported',()=>{const e=registry.entries.find(e=>e.espnId==='57')!;assert.equal(mascotForTeam(e.espnId,e.school),'Albert / Alberta');const f=registry.entries.find(e=>e.espnId==='110242')!;assert.equal(mascotForTeam(f.espnId,f.school),'Argie the Argonaut');});
test('mismatched provider IDs, unknown teams and wrong seasons never borrow another mascot',()=>{assert.equal(mascotForTeam('52','Alabama Crimson Tide'),'Not available');assert.equal(mascotForTeam('2633','Alabama Crimson Tide'),'Not available');assert.equal(mascotForTeam('999999','Unknown'),'Not available');assert.equal(mascotForTeam('2633','Tennessee Volunteers',2025),'Not available');});

test('verified absence is distinct from unresolved data and unofficial mascots',()=>{for(const id of ['24','52','21','2439','159']){const e=registry.entries.find(e=>e.espnId===id)!;assert.equal(mascotForTeam(id,e.school),'No official mascot');}const e=registry.entries.find(e=>e.espnId==='309')!;assert.equal(mascotForTeam(e.espnId,e.school),'Not available');});
