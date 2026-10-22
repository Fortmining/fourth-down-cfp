import { chromium,webkit,devices } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:3001';
for(const [engine,device] of [[chromium,null],[webkit,'iPhone 13']]) {
 const browser=await engine.launch();
 try {
  const context=await browser.newContext(device?devices[device]:{});
  await context.addInitScript(()=>{
   localStorage.setItem('fourth-down-alert-preferences-v1',JSON.stringify({version:1,favorites:[],myTeams:{enabled:false,kickoff:false,final:false},breaking:{enabled:true,ap:true,coaches:false,cfp:false,upsets:false,developments:false}}));
   localStorage.setItem('fourth-down-push-control-v1',JSON.stringify({id:'a'.repeat(64),token:'b'.repeat(64)}));
   window.__permissionRequests=0;
   if(!('Notification' in window))window.Notification={};
   if(!('PushManager' in window))window.PushManager=function(){};
   Object.defineProperty(Notification,'permission',{configurable:true,get:()=> 'granted'});
   Notification.requestPermission=async()=>{window.__permissionRequests++;return 'granted';};
   navigator.serviceWorker.getRegistration=async()=>({pushManager:{getSubscription:async()=>({})}});
  });
  const page=await context.newPage();const sent=[];
  await page.route('**/api/alerts/config',r=>r.fulfill({json:{available:true,publicKey:'test-only'}}));
  await page.route('**/api/alerts/test',r=>{sent.push(r.request().postDataJSON());return r.fulfill({json:{ok:true,message:'Background test queued. Close Fourth Down or lock your phone now.'}});});
  await page.goto(base+'/#alerts');
  const button=page.getByRole('button',{name:'Send background test',exact:true});
  await button.click();
  await page.getByText('Background test queued. Close Fourth Down or lock your phone now.',{exact:true}).waitFor();
  assert.equal(sent.length,1);assert.equal(sent[0].mode,'background');assert.equal(sent[0].id,'a'.repeat(64));
  assert.equal(await page.evaluate(()=>window.__permissionRequests),0,'An existing subscription test must not prompt again');
  await page.getByRole('checkbox',{name:'New Coaches Poll',exact:true}).check();
  assert.equal(await button.isDisabled(),true,'Unsaved settings cannot be used for a background test');
  await page.reload();await button.waitFor();assert.equal(await button.isDisabled(),true,'Unsaved settings remain pending after reload');
  console.log(engine.name()+': background test queues with the device capability, avoids permission prompts, and requires saved settings.');
  await context.close();
 }finally{await browser.close();}
}
