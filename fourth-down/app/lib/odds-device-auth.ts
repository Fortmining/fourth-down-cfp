import {createHash,randomBytes} from 'node:crypto';
import {oddsRedis} from './private-odds-cache.ts';
import {equalSecret,validOddsSession} from './private-odds-auth.ts';
export const deviceCookie='fd-odds-device';
export const deviceSeconds=180*86400;
const scope='fd:{private-odds-v1}:access-v1';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const slotKey=(slot:number)=>scope+':slot:'+slot;
export function oddsAdmin(request:Request){const secret=process.env.ODDS_DEV_ACCESS_TOKEN;return !!secret&&secret.length>=32&&equalSecret(request.headers.get('authorization')||'','Bearer '+secret);}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
export async function issueDeviceApproval(slot:number){
 if(!Number.isInteger(slot)||slot<0||slot>2)throw Error('Choose one of three authorized people');
 const code=randomBytes(32).toString('base64url');
 await oddsRedis('SET',scope+':approval:'+hash(code),String(slot),'EX',86400);
 return code;
}
export async function enrollDevice(code:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(code))throw Error('Approval link is invalid or expired');
 const key=scope+':approval:'+hash(code),slot=await oddsRedis('GET',key);
 if(!/^[012]$/.test(String(slot)))throw Error('Approval link is invalid or expired');
 return registerDevice(Number(slot),key);
}
async function registerDevice(slot:number,approval?:string){
 const value=slot+'.'+randomBytes(32).toString('base64url'),digest=hash(value),now=Date.now(),expires=now+deviceSeconds*1000;
 const granted=await oddsRedis('EVAL',`if ARGV[4]~='' and redis.call('GET',KEYS[2])~=ARGV[4] then return 0 end
 local devices=cjson.decode(redis.call('GET',KEYS[1]) or '[]');local active={}
 for _,d in ipairs(devices) do if d.expires>tonumber(ARGV[1]) then table.insert(active,d) end end
 if #active>=4 then return -1 end
 table.insert(active,{hash=ARGV[2],expires=tonumber(ARGV[3])})
 redis.call('SET',KEYS[1],cjson.encode(active),'EX',15552000)
 if ARGV[4]~='' then redis.call('DEL',KEYS[2]) end;return 1`,2,slotKey(slot),approval||scope+':unused',now,digest,expires,approval?String(slot):'');
 if(granted!==1)throw Error(granted===-1?'This person already has four approved devices':'Approval link is invalid or expired');
 return value;
}
export async function authorizedDevice(value:string|undefined){
 if(!value||! /^[012]\.[A-Za-z0-9_-]{43}$/.test(value))return false;
 const raw=await oddsRedis('GET',slotKey(Number(value[0])));if(!raw)return false;
 const devices=JSON.parse(raw) as {hash:string;expires:number}[];
 return devices.some(d=>d.expires>Date.now()&&equalSecret(d.hash,hash(value)));
}
export async function migrateOddsSession(legacy:string|undefined){
 const secret=process.env.ODDS_DEV_ACCESS_TOKEN;
 if(!secret||!validOddsSession(legacy,secret))return null;
 return registerDevice(0);
}
export async function revokeOddsDevices(slot:number){if(!Number.isInteger(slot)||slot<0||slot>2)throw Error('Invalid person');await oddsRedis('DEL',slotKey(slot));}
