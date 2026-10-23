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
 if(message.test===true)return !!(p.myTeams?.enabled||p.breaking?.enabled||p.following?.enabled);
 const types=Array.isArray(message.types)?message.types:[];
 const gameId=/^game:([^:]+):/.exec(message.id)?.[1];
 const followed=p.following?.enabled&&(types.includes('kickoff')||types.includes('final'))&&p.following.items?.some(f=>f.createdAt<=(message.eligibilityAt??message.observedAt)&&f.expiresAt>Date.now()&&(f.duration==='game'?f.gameId===gameId:f.kind==='team'&&message.teamIds?.includes(f.id)));
 const team=p.myTeams?.enabled&&Array.isArray(message.teamIds)&&message.teamIds.some(id=>p.favorites?.some(t=>t.id===id));
 return !!(followed || (team&&((p.myTeams.kickoff&&types.includes('kickoff'))||(p.myTeams.final&&types.includes('final'))))||
 (p.breaking?.enabled&&((p.breaking.upsets&&types.includes('upset'))||(p.breaking.developments&&types.includes('development'))||['ap','coaches','cfp'].some(type=>p.breaking[type]&&types.includes(type)))));
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
self.addEventListener('push',event=>{
 if(!event.data)return;
 event.waitUntil((async()=>{
  let message;try{message=event.data.json();}catch{return;}
  if(!message.id||!message.title||!message.body)return;
  if(message.expiresAt!==undefined&&(!Number.isFinite(message.expiresAt)||Date.now()>=message.expiresAt))return;
  const db=await openAlertsDb();
  const preferences=await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readonly');const get=tx.objectStore('settings').get('preferences');get.onsuccess=()=>resolve(get.result);get.onerror=reject;});
  if(!selected(message,preferences)){db.close();return;}
  // Atomic IDB claims survive worker restarts and duplicate provider pushes.
  const fresh=await new Promise(resolve=>{const tx=db.transaction('seen','readwrite');const store=tx.objectStore('seen');const get=store.get(message.id);let claimed=false;get.onsuccess=()=>{if(!get.result){store.put(Date.now(),message.id);claimed=true;}};tx.oncomplete=()=>resolve(claimed);tx.onabort=()=>resolve(false);});
  db.close();if(!fresh)return;
  await self.registration.showNotification(message.title,{body:message.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:message.id,data:{url:message.url},actions:[{action:'settings',title:'Alert settings'}]});
  if(/^[a-f0-9]{64}$/.test(message.receipt||''))try{
   await fetch('/api/alerts/receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receipt:message.receipt,workerVersion:'0.6.2',platform:typeof navigator==='undefined'?'unknown':/iPhone|iPad|iPod/.test(navigator.userAgent)?'ios':/Macintosh/.test(navigator.userAgent)?'macos':'other',openClients:await self.clients.matchAll({type:'window',includeUncontrolled:true}).then(t=>Math.min(t.length,1000)).catch(()=>null)})});
  }catch{}
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
