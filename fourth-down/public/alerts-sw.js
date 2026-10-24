// Push only: never intercept or cache scores, rankings, API requests, or pages.
function openAlertsDb() {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('fourth-down-alerts',2);
  request.onupgradeneeded=()=>{for(const name of ['seen','settings'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
function selected(message,p) {
 if(!p)return false;
 if(message.test===true)return !!(p.myTeams?.enabled||p.breaking?.enabled||p.following?.enabled||p.pulse?.enabled);
 const types=Array.isArray(message.types)?message.types:[];
 const gameId=/^game:([^:]+):/.exec(message.id)?.[1];
 const extras=['halftime','close','upsetWatch','confirmedUpset','scoring'];
 const followsType=f=>types.some(t=>f.alerts ? f.alerts[t]===true : (t==='kickoff'||t==='final'?p.gameAlerts?.following?.[t]!==false:extras.includes(t)&&p.gameAlerts?.following?.[t]===true));
 const followed=p.following?.enabled&&p.following.items?.some(f=>followsType(f)&&f.createdAt<=(message.eligibilityAt??message.observedAt)&&f.expiresAt>Date.now()&&(f.duration==='game'?f.gameId===gameId:f.kind==='team'&&message.teamIds?.includes(f.id)));
 const team=p.myTeams?.enabled&&Array.isArray(message.teamIds)&&message.teamIds.some(id=>p.favorites?.some(t=>t.id===id));
 const favorite=team&&((p.myTeams.kickoff&&types.includes('kickoff'))||(p.myTeams.final&&types.includes('final'))||extras.some(t=>types.includes(t)&&p.gameAlerts?.favorites?.[t]===true));
 const breaking=p.breaking?.enabled&&((p.breaking.upsets&&types.includes('upset'))||(p.breaking.developments&&types.includes('development'))||['ap','coaches','cfp'].some(t=>p.breaking[t]&&types.includes(t)));
 const already=p.favorites?.some(t=>message.teamIds?.includes(t.id))||p.following?.items?.some(f=>f.expiresAt>Date.now()&&(f.duration==='game'?f.gameId===gameId:f.kind==='team'&&message.teamIds?.includes(f.id)));
 const national=p.pulse?.enabled&&types.some(t=>['pulseUpset','pulseFinal','pulseClose','pulseInteresting'].includes(t)?p.pulse.categories?.[t]===true:['ap','coaches','cfp'].includes(t)&&p.pulse.rankings?.[t]===true);
 const invite=types.some(t=>['pulseUpset','pulseClose','pulseInteresting'].includes(t));
 return !!(followed||favorite||breaking||(national&&(!invite||(!already&&message.discovery?.expiresAt>Date.now()))));
}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data?.type!=='alert-preferences')return;
 event.waitUntil((async()=>{
  try{
   const db=await openAlertsDb();
   await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(event.data.preferences,'preferences');tx.oncomplete=resolve;tx.onabort=reject;});
   db.close();event.ports[0]?.postMessage({ok:true});
  }catch{event.ports[0]?.postMessage({ok:false});}
 })());
});
// Telemetry never gates showing an eligible notification. The received request runs
// alongside local checks; terminal outcomes are reported after display/suppression.
async function reportOutcome(message,outcome,receivedAt,scope) {
 if(!/^[a-f0-9]{64}$/.test(message.receipt||''))return;
 try{await fetch(outcome==='displayed'?'/api/alerts/receipt':'/api/alerts/receipt-status',{method:'POST',headers:{'Content-Type':'application/json'},...(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(2500)}:{}),body:JSON.stringify({receipt:message.receipt,outcome,receivedAt,scope,workerVersion:'0.8.3',platform:typeof navigator==='undefined'?'unknown':/iPhone|iPad|iPod/.test(navigator.userAgent)?'ios':/Macintosh/.test(navigator.userAgent)?'macos':'other',openClients:await self.clients.matchAll({type:'window',includeUncontrolled:true}).then(t=>Math.min(t.length,1000)).catch(()=>null)})});}catch{}
}
self.addEventListener('push',event=>{
 if(!event.data)return;
 event.waitUntil((async()=>{
  let message;try{message=event.data.json();}catch{return;}
  if(!message.id||!message.title||!message.body)return;
  const receivedAt=Date.now(),received=reportOutcome(message,'received',receivedAt);
  const report=async(outcome,scope)=>{await received;await reportOutcome(message,outcome,receivedAt,scope);};
  if(message.expiresAt!==undefined&&(!Number.isFinite(message.expiresAt)||Date.now()>=message.expiresAt)){await report('expired');return;}
  let db,preferences;
  try{db=await openAlertsDb();preferences=await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readonly');const get=tx.objectStore('settings').get('preferences');get.onsuccess=()=>resolve(get.result);get.onerror=reject;});}
  catch{db?.close();await report('storage-failed');return;}
  const scope={settingsPresent:!!preferences,finalEnabled:preferences?.myTeams?.final===true,favoriteMatch:message.teamIds?.some(id=>preferences?.favorites?.some(t=>t.id===id))===true,favoriteEnabled:preferences?.myTeams?.enabled===true,kickoffEnabled:preferences?.myTeams?.kickoff===true,categoryEnabled:message.types?.some(t=>preferences?.gameAlerts?.favorites?.[t]===true)===true,followingEnabled:preferences?.following?.enabled===true};
  if(!selected(message,preferences)){db.close();await report('not-selected',scope);return;}
  // Atomic IDB claims survive worker restarts and duplicate provider pushes.
  let fresh;
  try{fresh=await new Promise(resolve=>{const tx=db.transaction('seen','readwrite');const store=tx.objectStore('seen');const get=store.get(message.id);let claimed=false;get.onsuccess=()=>{if(!get.result){store.put(Date.now(),message.id);claimed=true;}};tx.oncomplete=()=>resolve(claimed);tx.onabort=()=>resolve(null);});}
  catch{db.close();await report('storage-failed',scope);return;}
  db.close();if(fresh===null){await report('storage-failed',scope);return;}if(!fresh){await report('duplicate',scope);return;}
  try{await self.registration.showNotification(message.title,{body:message.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:message.id,data:{url:message.url},actions:[{action:'settings',title:'Alert settings'}]});}
  catch{await report('display-failed',scope);return;}
  await report('displayed',scope);
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  let target=new URL('/#alerts',self.location.origin);
  if(event.action!=='settings')try{const candidate=new URL(event.notification.data?.url||'/',self.location.origin);if(candidate.protocol==='https:'&&(candidate.origin===self.location.origin||['www.espn.com','www.afca.com','apnews.com','collegefootballplayoff.com','www.ncaa.com','ncaa.com'].includes(candidate.hostname)))target=candidate;}catch{}
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const tab of tabs)if(new URL(tab.url).origin===target.origin){await tab.navigate(target.href);await tab.focus();return;}
  await self.clients.openWindow(target.href);
 })());
});
