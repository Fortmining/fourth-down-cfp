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
export async function issueDeviceApproval(slot:number,manual=false){
 if(!Number.isInteger(slot)||slot<0||slot>2)throw Error('Choose one of three authorized people');
 const code=manual?randomBytes(6).toString('hex').toUpperCase():randomBytes(32).toString('base64url');
 const granted=await oddsRedis('SET',scope+':approval:'+hash(code),String(slot),'NX','EX',86400);
 if(granted!=='OK')throw Error('Unable to create a unique approval');
 return code;
}
export function normalizeDeviceApproval(value:string){const compact=value.replace(/[\s-]/g,'');return /^[a-f0-9]{12}$/i.test(compact)?compact.toUpperCase():value.trim();}
export async function enrollDevice(code:string){
 code=normalizeDeviceApproval(code);
 if(!/^(?:[A-F0-9]{12}|[A-Za-z0-9_-]{43})$/.test(code))throw Error('Approval link is invalid or expired');
 if(code.length===12){
  // Small personal audience: one shared, bounded attempt bucket, including across instances.
  const allowed=await oddsRedis('EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],900) end;return n<=20 and 1 or 0",1,scope+':code-attempts:'+Math.floor(Date.now()/900000));
  if(allowed!==1)throw Error('Approval attempts temporarily limited');
 }
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
