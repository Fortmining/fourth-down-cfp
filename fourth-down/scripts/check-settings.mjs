import { chromium,webkit,devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:3001';
for(const [engine,device] of [[chromium,null],[webkit,'iPhone 13']]) {
 const browser=await engine.launch();
 try {
  const context=await browser.newContext(device?{...devices[device],reducedMotion:'reduce'}:{viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(()=>{
   window.__permissionRequests=0;
   if('Notification' in window)Notification.requestPermission=async()=>{window.__permissionRequests++;return 'denied';};
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('.pollStatus').first().waitFor();
  await page.getByRole('link',{name:'Get the App',exact:true}).click();
  await page.getByRole('heading',{name:'Get the App',exact:true}).waitFor();
  assert.ok(await page.getByRole('heading',{name:'iPhone / iPad'}).isVisible());
  assert.ok(await page.getByRole('heading',{name:'Android',exact:true}).isVisible());
  assert.ok(await page.getByRole('heading',{name:'Desktop',exact:true}).isVisible());
  const trackerNav=page.getByRole('navigation',{name:device?'Mobile tracker navigation':'Tracker sections'});
  assert.ok(await trackerNav.isVisible());
  assert.equal(await page.getByRole('navigation',{name:device?'Tracker sections':'Mobile tracker navigation'}).isVisible(),false);
  await trackerNav.getByRole('link',{name:'More',exact:true}).click();
  await page.getByRole('checkbox',{name:'My Teams alerts',exact:false}).check();
  await page.getByRole('checkbox',{name:'Kickoff confirmed',exact:true}).check();
  await page.getByRole('searchbox',{name:'Find your teams'}).fill('Miami');
  const favorite=page.locator('.favoriteList input').first();await favorite.waitFor();await favorite.check();
  await page.getByRole('checkbox',{name:'Breaking CFP News alerts',exact:false}).check();
  await page.getByRole('checkbox',{name:'New AP Top 25',exact:true}).check();
  await page.reload();await page.waitForFunction(()=>{const fieldset=document.querySelector('#alerts fieldset');return fieldset&&!fieldset.disabled;});
  assert.equal(await page.getByRole('checkbox',{name:'My Teams alerts',exact:false}).isChecked(),true);
  assert.equal(await page.getByRole('checkbox',{name:'Kickoff confirmed',exact:true}).isChecked(),true);
  assert.equal(await page.getByRole('checkbox',{name:'New AP Top 25',exact:true}).isChecked(),true);
  assert.equal(await page.getByRole('checkbox',{name:'New Coaches Poll',exact:true}).isChecked(),false);
  assert.equal(await page.getByRole('checkbox',{name:'Final scores',exact:true}).isChecked(),false);
  assert.equal(await page.locator('.favoriteChips button').count(),1);
  await page.getByRole('checkbox',{name:'My Teams alerts',exact:false}).uncheck();
  assert.equal(await page.getByRole('checkbox',{name:'Breaking CFP News alerts',exact:false}).isChecked(),true);
  assert.equal(await page.evaluate(()=>window.__permissionRequests),0,'No automatic permission prompt');
  await page.getByRole('button',{name:'Unsubscribe from all alerts',exact:true}).click();
  await page.getByText('Unsubscribed from all alerts on this device. Your favorite teams are kept.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Breaking CFP News alerts',exact:false}).isChecked(),false);
  assert.equal(await page.locator('.favoriteChips button').count(),1);
  assert.equal(await page.getByRole('button',{name:'Enable Notifications',exact:true}).isDisabled(),true);
  if(!device)for(const appearance of ['light','dark'])for(const colorway of ['stadium','turf','prime']) {
   await page.getByRole('button',{name:appearance==='light'?'☀ Light':'☾ Dark',exact:true}).click();
   await page.getByLabel('Colorway',{exact:true}).selectOption(colorway);
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${appearance}/${colorway}`);
  }
  if(device){
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
   await page.getByRole('navigation',{name:'Mobile tracker navigation'}).getByRole('link',{name:'More',exact:true}).click();
   await page.screenshot({path:process.env.SETTINGS_SCREENSHOT||'/tmp/fd-v05-settings.png'});
  }
  assert.deepEqual(errors,[]);
  console.log(`${engine.name()}: More, installation guide, responsive navigation, independent persistent preferences, favorites, all-off unsubscribe, and no unsolicited prompt passed.`);
  await context.close();
 } finally{await browser.close();}
}
