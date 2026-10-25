import {chromium,firefox,webkit} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const url=process.env.TEST_URL||'http://127.0.0.1:3009';
for(const engine of [chromium,firefox,webkit]){
 const browser=await engine.launch(),context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();let creates=0,updates=0,deletes=0,tests=0,fail=false;
 await context.addInitScript(()=>{
  window.__prompts=0;window.__subscribes=0;
  Object.defineProperty(window,'Notification',{configurable:true,value:{permission:localStorage.getItem('grant')||'default',requestPermission:async()=>{window.__prompts++;Notification.permission='granted';localStorage.setItem('grant','granted');return 'granted';}}});
  Object.defineProperty(window,'PushManager',{configurable:true,value:class{}});
  const sub={toJSON:()=>({endpoint:'https://fcm.googleapis.com/desktop-fixture',keys:{p256dh:'fixture',auth:'fixture'}}),unsubscribe:async()=>{localStorage.removeItem('sub');return true;}};
  const reg={active:{postMessage:(m,ports)=>ports[0].postMessage({ok:true})},update:async()=>{},pushManager:{getSubscription:async()=>localStorage.getItem('sub')?sub:null,subscribe:async()=>{window.__subscribes++;localStorage.setItem('sub','yes');return sub;}}};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>reg,register:async()=>reg,ready:Promise.resolve(reg)}});
 });
 await page.route('**/api/live',r=>r.fulfill({json:{games:[],rankings:[],polls:[],season:2026,updatedAt:new Date().toISOString(),warnings:[]}}));
 await page.route('**/api/alerts/config',r=>r.fulfill({json:{available:true,publicKey:'AQAB'}}));
 await page.route('**/api/alerts/subscription',r=>{const d=r.request().postDataJSON();if(fail)return r.fulfill({status:503,json:{error:'Offline fixture: retry'}});if(d.action==='create')creates++;if(d.action==='update')updates++;if(d.action==='delete')deletes++;return r.fulfill({json:{ok:true,id:'desktop-only',token:'desktop-capability',preferences:d.preferences}});});
 await page.route('**/api/alerts/test',r=>{tests++;assert.equal(r.request().postDataJSON().id,'desktop-only');return r.fulfill({json:{ok:true,message:'Test sent to the push provider. Provider acceptance alone does not confirm display.'}});});
 await page.goto(url+'/#alerts');const enable=page.getByRole('button',{name:'Enable Desktop Notifications',exact:true});await enable.waitFor();await page.waitForFunction(()=>!document.querySelector('.desktopPush button').disabled);assert.equal(await page.evaluate(()=>window.__prompts),0);await enable.click();await page.getByRole('alert').filter({hasText:'Choose the alerts'}).waitFor();assert.equal(await page.evaluate(()=>window.__prompts),0);
 await page.getByRole('checkbox',{name:/^National alerts/}).check();await page.getByRole('radio',{name:'Quiet',exact:true}).click();fail=true;await enable.click();await page.getByRole('alert').filter({hasText:'Offline fixture'}).waitFor();assert.equal(creates,0);assert.equal(await page.evaluate(()=>localStorage.getItem('fourth-down-push-control-v1')),null);fail=false;await enable.click();await page.locator('.desktopPush').getByRole('status').filter({hasText:'Subscribed in this browser'}).waitFor();assert.equal(creates,1);
 await page.getByRole('button',{name:'Send Test Notification',exact:true}).click();await page.getByRole('alert').filter({hasText:'does not confirm display'}).waitFor();assert.equal(tests,1);
 await page.reload();await page.locator('.desktopPush').getByRole('status').filter({hasText:'Subscribed in this browser'}).waitFor();assert.equal(await page.evaluate(()=>window.__prompts),0);assert.equal(await page.evaluate(()=>window.__subscribes),0);await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.locator('.notificationSave').getByRole('status').filter({hasText:'Server confirmed'}).waitFor();assert.equal(creates,1);assert.equal(updates,1);
 const other=await browser.newContext();const otherPage=await other.newPage();await otherPage.goto(url);await otherPage.evaluate(()=>localStorage.setItem('fourth-down-push-control-v1',JSON.stringify({id:'iphone-fixture',token:'unrelated'})));
 await page.locator('summary').filter({hasText:/^Device & delivery$/}).click();await page.getByRole('button',{name:'Disable notifications for this browser',exact:true}).click();await page.getByRole('alert').filter({hasText:'Unsubscribed from all alerts on this device'}).waitFor();assert.equal(deletes,1);assert.equal(JSON.parse(await otherPage.evaluate(()=>localStorage.getItem('fourth-down-push-control-v1'))).id,'iphone-fixture');
 await page.evaluate(()=>{Notification.permission='denied';window.dispatchEvent(new Event('focus'));});await page.locator('.desktopPush').getByRole('status').filter({hasText:'Blocked'}).waitFor();assert.equal(await enable.isDisabled(),true);assert.equal(await page.evaluate(()=>window.__prompts),0);
 const axe=await new AxeBuilder({page}).include('#alerts').withTags(['wcag2a','wcag2aa']).analyze();assert.deepEqual(axe.violations.map(x=>x.id),[]);
 console.log(engine.name()+': desktop no-install UI, explicit gesture, save failure/retry, subscription reuse, test acceptance wording, permission block, browser isolation and accessibility passed (simulated PushManager/server; no real provider delivery).');await browser.close();
}
