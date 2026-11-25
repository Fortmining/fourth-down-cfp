import {createHmac,timingSafeEqual} from 'node:crypto';
export function privateOddsEnabled(){return process.env.FOURTH_DOWN_PRIVATE_ODDS==='true'&&(process.env.VERCEL_ENV==='production'?process.env.FOURTH_DOWN_PRIVATE_ODDS_PRODUCTION==='true':process.env.NODE_ENV==='development'||process.env.VERCEL_ENV==='preview');}
export function equalSecret(value:string,expected:string){const a=Buffer.from(value),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
export function oddsSession(secret:string,expires=Date.now()+3600000){const payload=String(expires);return payload+'.'+createHmac('sha256',secret).update('fd-private-odds:'+payload).digest('hex');}
export function validOddsSession(value:string|undefined,secret:string){if(!value)return false;const [expiry]=value.split('.');return /^\d+$/.test(expiry)&&Number(expiry)>Date.now()&&Number(expiry)<=Date.now()+3600000&&equalSecret(value,oddsSession(secret,Number(expiry)));}
