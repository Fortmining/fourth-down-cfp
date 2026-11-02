// A strict allowlist: never record endpoint URLs, capability tokens or complete preferences.
export function sanitizeWorkerScope(value:unknown){if(!value||typeof value!=='object')return undefined;const input=value as Record<string,unknown>,out:Record<string,boolean|number>={};
 for(const key of ['settingsPresent','favoriteMatch','favoriteEnabled','kickoffEnabled','finalEnabled','categoryEnabled','followingEnabled','followingMatch','followingCategoryEnabled','followingCreatedBeforeEvent','followingUnexpired','payloadObservedAtValid','payloadEligibilityAtValid','payloadTeamIdsValid'])if(typeof input[key]==='boolean')out[key]=input[key] as boolean;
 for(const key of ['followingCount','matchingFollowCount'])if(Number.isInteger(input[key])&&(input[key] as number)>=0&&(input[key] as number)<=40)out[key]=input[key] as number;
 return out;
}
export function sanitizeDeviceSubscriptionFacts(value:Record<string,unknown>){const nullable=(key:string)=>typeof value[key]==='boolean'?value[key]:null;return {pushSubscriptionPresent:nullable('pushSubscriptionPresent'),subscriptionMatchesControl:nullable('subscriptionMatchesControl'),workerScriptExpected:nullable('workerScriptExpected'),workerPending:value.workerPending===true};}

// General and game-specific audit copies describe the same operation. Merge their
// fields instead of presenting two provider attempts or two worker receipts.
export function mergeGameAudit(entries:string[],gameId:string,limit=300){
 const merged=new Map<string,Record<string,unknown>>();for(const raw of entries){let e:Record<string,unknown>;try{e=JSON.parse(raw);}catch{continue;}
 if(typeof e.eventId!=='string'||!e.eventId.startsWith('game:'+gameId+':')||typeof e.kind!=='string'||typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at)))continue;
 const operation=typeof e.runId==='string'?'run:'+e.runId:Number.isFinite(e.receivedAt)?'receipt:'+e.receivedAt:null;
 const key=operation?JSON.stringify([e.kind,e.eventId,operation,e.outcome??'',e.stage??'']):raw,old=merged.get(key);
 merged.set(key,old?{...old,...e,at:Date.parse(old.at as string)<Date.parse(e.at)?old.at:e.at}:e);
 }return [...merged.values()].sort((a,b)=>Date.parse(b.at as string)-Date.parse(a.at as string)).slice(0,Math.min(300,Math.max(1,limit)));
}
