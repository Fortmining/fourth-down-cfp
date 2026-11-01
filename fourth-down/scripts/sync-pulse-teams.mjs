import fs from 'node:fs';import crypto from 'node:crypto';
const raw=fs.readFileSync(new URL('../app/data/mascots-2026.json',import.meta.url),'utf8'),source=JSON.parse(raw);
const rows=source.entries.map(t=>({id:t.espnId,name:t.school,conference:t.conference,division:t.division,ownershipCandidates:t.sources}));
const packet={season:source.season,source:'Existing Fourth Down mascots-2026 registry; identities/conferences only',sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),teams:rows.filter(t=>t.division==='fbs'),disambiguation:rows.filter(t=>t.division!=='fbs').map(({id,name})=>({id,name}))};
fs.writeFileSync(new URL('../app/data/pulse-teams-2026.json',import.meta.url),JSON.stringify(packet));console.log(packet.teams.length+' canonical FBS programs synchronized');
