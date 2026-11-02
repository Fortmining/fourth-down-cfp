import {decodeArchive,type StoryArchive,type StoryStore} from './pulse-story-store.ts';
export type PulseRedisPort=(...command:(string|number)[])=>Promise<unknown>;
export const PULSE_ARCHIVE_KEYS=['fd:{pulse-stories-v1}:archive','fd:{pulse-stories-v1}:meter'] as const;
// Atomic CAS, retention and accepted-operation resource meter. No production key names.
// Rejected HTTP/EVAL requests still consume resources; shared-cache request admission is required.
export const pulseArchiveScript=`
if #KEYS~=2 or KEYS[1]~='fd:{pulse-stories-v1}:archive' or KEYS[2]~='fd:{pulse-stories-v1}:meter' then return redis.error_reply('Pulse keys only') end
local mode,expected,value,day,units,quota=ARGV[1],ARGV[2],ARGV[3],ARGV[4],tonumber(ARGV[5]),tonumber(ARGV[6])
if (mode~='read' and mode~='commit' and mode~='quota') or #value>700000 or not string.match(day,'^%d%d%d%d%-%d%d%-%d%d$') then return redis.error_reply('Invalid Pulse operation') end
local raw=redis.call('GET',KEYS[2]);local meter={day=day,commands=0,writes=0,reads=0,youtube=0,bytes=0}
if raw then local ok,m=pcall(cjson.decode,raw);if not ok then return redis.error_reply('Invalid meter') end;meter=m end
if day<meter.day then return {'limited'} end
if day>meter.day then meter={day=day,commands=0,writes=0,reads=0,youtube=0,bytes=0} end
local cost=mode=='commit' and 5 or (mode=='read' and 4 or 3);local writes=mode=='commit' and 2 or 1;local reads=mode=='quota' and 1 or 2
if mode=='quota' and (not units or units<1 or units>2 or not quota or quota<1 or quota>5000 or meter.youtube+units>quota) then return {'limited'} end
if meter.commands+cost>2000 or meter.writes+writes>600 or meter.reads+reads>1500 then return {'limited'} end
local current=mode=='quota' and '' or (redis.call('GET',KEYS[1]) or '')
local bytes=mode=='commit' and #value+#current or #current
if meter.bytes+bytes>100000000 then return {'limited'} end
meter.commands=meter.commands+cost;meter.writes=meter.writes+writes;meter.reads=meter.reads+reads;meter.bytes=meter.bytes+bytes
if mode=='quota' then meter.youtube=meter.youtube+units end
redis.call('SET',KEYS[2],cjson.encode(meter),'EX',172800)
if mode=='quota' then return {'reserved'} end
local generation=0;if current~='' then local ok,stored=pcall(cjson.decode,current);if not ok or stored.version~=1 or type(stored.generation)~='number' then return redis.error_reply('Invalid archive') end;generation=stored.generation end
if mode=='read' then local payload='';if current~='' then payload=cjson.decode(current).payload end;return {'read',payload,'v'..tostring(generation)} end
if 'v'..tostring(generation)~=expected then return {'conflict'} end
local ok,v=pcall(cjson.decode,value);if not ok or v.version~=1 or type(v.generation)~='number' or type(v.checkedAt)~='string' or type(v.payload)~='string' or string.find(v.payload,'[^%w%+%/=]') then return redis.error_reply('Invalid archive') end
if current~='' then local valid,old=pcall(cjson.decode,current);if not valid or v.generation~=old.generation+1 or v.checkedAt<old.checkedAt then return {'conflict'} end elseif v.generation~=1 then return {'conflict'} end
redis.call('SET',KEYS[1],value,'EX',15552000)
return {'saved'}
`;
function decodedResult(value:unknown):string[]{if(!Array.isArray(value)||value.some(v=>typeof v!=='string'))throw Error('Invalid Pulse Redis response');return value as string[];}
export function pulseRedisStore(port:PulseRedisPort,clock=Date.now):StoryStore&{reserveYouTube:(units:number,quota:number)=>Promise<boolean>}{const run=async(mode:string,expected='',value='',units=0,quota=0)=>decodedResult(await port('EVAL',pulseArchiveScript,2,...PULSE_ARCHIVE_KEYS,mode,expected,value,new Date(clock()).toISOString().slice(0,10),units,quota));return {read:async()=>{const r=await run('read');if(r[0]!=='read')throw Error('Pulse storage limited');const raw=r[1]?Buffer.from(r[1],'base64').toString('utf8'):'';if(r[1]&&Buffer.from(raw).toString('base64')!==r[1])throw Error('Archive transport mismatch');const state=decodeArchive(raw);if(r[2]!=='v'+(state?.generation||0))throw Error('Archive generation mismatch');return {state,etag:r[2]};},commit:async(expected,state:StoryArchive)=>{decodeArchive(JSON.stringify(state));const value=JSON.stringify({version:1,generation:state.generation,checkedAt:state.checkedAt,payload:Buffer.from(JSON.stringify(state)).toString('base64')});const r=await run('commit',expected,value);if(!['saved','limited','conflict'].includes(r[0]))throw Error('Invalid Pulse commit');return r[0] as 'saved'|'limited'|'conflict';},reserveYouTube:async(units,quota)=>{if(!Number.isInteger(units)||units<1||units>2||!Number.isInteger(quota)||quota<1||quota>5000)throw Error('Explicit quota required');return (await run('quota','','',units,quota))[0]==='reserved';}};}
