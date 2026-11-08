export type GameProgress={period:number|null;latestPlayAt:string|null};
// Clock/score reversals can be legitimate reviews; do not use elapsed wall time or
// a stationary game clock to declare a timeout/halftime stale.
export function isOlderGamePacket(previous:GameProgress|null,next:GameProgress){
 if(!previous)return false;
 if(previous.period!==null&&next.period!==null&&next.period<previous.period)return true;
 const a=Date.parse(previous.latestPlayAt||''),b=Date.parse(next.latestPlayAt||'');
 return Number.isFinite(a)&&Number.isFinite(b)&&b<a;
}
