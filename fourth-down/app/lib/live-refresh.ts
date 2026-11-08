// iOS can suspend timers while a Home Screen app is in the background.
// Resume events must fetch immediately instead of waiting for the next timer.
export function subscribeLiveRefresh(refresh:()=>unknown,doc:Document=document,win:Window=window,options:{intervalMs?:number;enabled?:()=>boolean}={}) {
 const resume=()=>{if(!doc.hidden&&options.enabled?.()!==false)void refresh();};
 const timer=win.setInterval(resume,options.intervalMs??60000);
 doc.addEventListener('visibilitychange',resume);
 for(const event of ['focus','pageshow','online'])win.addEventListener(event,resume);
 return ()=>{
  win.clearInterval(timer);
  doc.removeEventListener('visibilitychange',resume);
  for(const event of ['focus','pageshow','online'])win.removeEventListener(event,resume);
 };
}
