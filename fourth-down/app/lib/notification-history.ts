import {redis} from './push-store';
import type {AlertEvent} from './alerts';
export type HistoryEntry={id:string;title:string;body:string;url:string;types:string[];generatedAt:number;recordedAt:number;delivery:'generated-display-unverified'};
export async function recordNotification(id:string,event:AlertEvent){
 const key=`fd:v08:inbox:${id}`;const entry:HistoryEntry={id:event.id,title:event.title.slice(0,160),body:event.body.slice(0,700),url:event.url,types:event.types,generatedAt:event.observedAt,recordedAt:Date.now(),delivery:'generated-display-unverified'};
 await redis('LPUSH',key,JSON.stringify(entry));await redis('LTRIM',key,0,99);await redis('EXPIRE',key,30*86400);
}
