type DailyUsage = {day:string; commands:number; complete:boolean};
type BudgetReceipt = {
  observedAt:string; monthlyLimit:number; commandsUsed:number; daysRemaining:number;
  storageUsedBytes:number; storageLimitBytes:number; dailyUsage:DailyUsage[]; visitorReadReserve?:number;
};

/** Offline admission plan only. Never spends credits or installs a production writer. */
export function planShadowWrites(receipt:BudgetReceipt,pairBytes:number,requestedPairsPerDay:number) {
  const issues:string[]=[];
  const at=Date.parse(receipt.observedAt);
  if(!Number.isFinite(at)||[receipt.monthlyLimit,receipt.commandsUsed,receipt.daysRemaining,receipt.storageUsedBytes,
    receipt.storageLimitBytes,pairBytes,requestedPairsPerDay,receipt.visitorReadReserve??0,...receipt.dailyUsage.map(d=>d.commands)].some(n=>!Number.isSafeInteger(n)||n<0)||
    receipt.daysRemaining<1||receipt.daysRemaining>31||pairBytes<1||receipt.monthlyLimit<1||receipt.storageLimitBytes<1)
    throw Error('Invalid measured write-budget receipt');
  const dates=receipt.dailyUsage.map(d=>Date.parse(d.day+'T00:00:00Z'));
  if(dates.some((day,i)=>!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==receipt.dailyUsage[i].day||day>at)||new Set(dates).size!==dates.length)
    throw Error('Invalid, future or duplicate daily observations');
  const complete=receipt.dailyUsage.filter((d,i)=>d.complete&&dates[i]+86400000<=at);
  if(receipt.dailyUsage.some((d,i)=>d.complete&&dates[i]+86400000>at))issues.push('A claimed complete day is still in progress');
  const byWeekday=new Map<number,number>();
  for(const d of complete){const weekday=new Date(d.day+'T00:00Z').getUTCDay();byWeekday.set(weekday,Math.max(byWeekday.get(weekday)||0,d.commands));}
  const days=[...complete].sort((a,b)=>a.day.localeCompare(b.day));
  const consecutive=days.some((d,i)=>i>=6&&Date.parse(d.day)-Date.parse(days[i-6].day)===6*86400000);
  if(!consecutive||byWeekday.size!==7)issues.push('Seven consecutive complete usage days are required, including a game-day weekend');
  if(complete.length&&at-Date.parse(days[days.length-1].day+'T00:00Z')>3*86400000)issues.push('Complete-day usage evidence is stale');
  let reservedBaseline=0;
  for(let day=0;day<receipt.daysRemaining;day++){
    const weekday=new Date(at+day*86400000).getUTCDay();
    // Until all weekdays are observed, retain the largest observed daily cost.
    reservedBaseline+=byWeekday.get(weekday)??Math.max(0,...complete.map(d=>d.commands));
  }
  const readCommands=360*receipt.daysRemaining;
  const visitorReads=receipt.visitorReadReserve??0;
  if(receipt.visitorReadReserve===undefined)issues.push('Public-view cache-miss reads have not been reserved');
  const available=Math.max(0,Math.floor(receipt.monthlyLimit*.8)-receipt.commandsUsed-reservedBaseline-readCommands-visitorReads);
  // Bounded retention measured 13 operations before eviction and 16 with eviction.
  // Reserve twenty for retries/accounting differences; hosted billing still gates activation.
  const commandsPerPair=20;
  const overheadBytes=512; // conservative index allowance; allocator overhead remains a separate unmeasured gate
  const storageReserve=Math.max(0,Math.min(64*1024*1024,Math.floor(receipt.storageLimitBytes*.8)-receipt.storageUsedBytes));
  const maxPairs=Math.min(Math.floor(available/commandsPerPair),Math.floor(storageReserve/(pairBytes+overheadBytes)));
  const requested=requestedPairsPerDay*receipt.daysRemaining;
  if(!Number.isSafeInteger(requested)||!Number.isSafeInteger(reservedBaseline))throw Error('Write-budget arithmetic overflow');
  if(requested>maxPairs)issues.push('Requested retention/write rate exceeds command or storage headroom');
  issues.push('Production writer, retry billing, shared-account CPU and actual allocator overhead remain unmeasured');
  return {observedAt:receipt.observedAt,completeUsageDays:complete.length,weeklyPatternObserved:consecutive&&byWeekday.size===7,
    existingCommandsReserved:reservedBaseline,periodicReadCommandsReserved:readCommands,visitorReadCommandsReserved:visitorReads,commandsPerPair,
    maxPairsWithinEstimatedHeadroom:maxPairs,maxPairsPerDay:Math.floor(maxPairs/receipt.daysRemaining),
    requestedPairs:requested,storageReserveBytes:storageReserve,indexAllowancePerPairBytes:overheadBytes,
    issues,additionalQstashDeliveries:0,additionalSchedules:0,transportInstalled:false,productionActivationPermitted:false};
}
