import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();let mutations=0;
 page.on('request',r=>{if(r.method()==='POST'&&/\/api\/alerts\//.test(r.url()))mutations++;});
 await page.addInitScript(()=>{
  window.__permissionPrompts=0;if('Notification' in window)Notification.requestPermission=async()=>{window.__permissionPrompts++;return 'denied';};
  if(!localStorage.getItem('fourth-down-alert-preferences-v1'))localStorage.setItem('fourth-down-alert-preferences-v1',JSON.stringify({version:1,favorites:[{id:'2633',name:'Tennessee Volunteers'}],myTeams:{enabled:true,kickoff:true,final:true},following:{enabled:false,items:[]},breaking:{enabled:true,ap:true,coaches:true,cfp:true}}));
 });
 await page.goto((process.env.CHECK_URL||'http://localhost:3107')+'/#alerts',{waitUntil:'domcontentloaded'});
 const favorite=page.getByRole('checkbox',{name:'Favorite teams · Halftime scores',exact:true});const following=page.getByRole('checkbox',{name:'Temporary follows · Halftime scores',exact:true});
 await favorite.waitFor();await page.waitForFunction(()=>!document.querySelector('input[aria-label="Favorite teams · Halftime scores"]').disabled&&!document.querySelector('input[aria-label="Favorite teams · Halftime scores"]').closest('fieldset').disabled);
 assert.equal(await favorite.isChecked(),false);assert.equal(await following.isChecked(),false);
 await following.check();assert.equal(await favorite.isChecked(),false);await favorite.check();
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('input[aria-label="Favorite teams · Halftime scores"]')?.checked);
 assert.equal(await following.isChecked(),true);
 const saved=await page.evaluate(()=>({p:JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')),prompts:window.__permissionPrompts}));
 assert.deepEqual(saved.p.favorites,[{id:'2633',name:'Tennessee Volunteers'}]);assert.equal(saved.p.breaking.ap,true);assert.equal(saved.p.following.enabled,false);assert.equal(saved.prompts,0);assert.equal(mutations,0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const accessibility=await new AxeBuilder({page}).include('#alerts').analyze();assert.deepEqual(accessibility.violations.map(v=>({id:v.id,impact:v.impact})),[]);
 console.log(JSON.stringify({viewport:'390x844',independentControls:true,persisted:true,favoritesPreserved:true,permissionPrompts:0,alertMutations:mutations,horizontalOverflow:false,accessibilityViolations:0}));
}finally{await browser.close();}
