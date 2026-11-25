import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const base=process.env.TEST_URL||'http://localhost:3015';
const out=process.env.QA_DIR||'/tmp/fd-premium-qa';fs.mkdirSync(out,{recursive:true});
const results=[];
for(const [engine,options,label] of [[chromium,{viewport:{width:1440,height:1000}},'desktop'],[webkit,devices['iPhone 13'],'mobile'],[chromium,{viewport:{width:820,height:1180}},'ipad']]){
 if(process.env.QA_ENGINE&&process.env.QA_ENGINE!==label)continue;
 const browser=await engine.launch();const context=await browser.newContext({...options,timezoneId:'America/New_York'});const page=await context.newPage();let gameHref=process.env.GAME_PATH||'';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.USE_PRODUCTION_DATA==='1')await page.route('**/api/**',async route=>{const u=new URL(route.request().url());if(route.request().method()!=='GET')return route.abort();try{const response=await route.fetch({url:'https://fourth-down-cfp.vercel.app'+u.pathname+u.search,timeout:30000});await route.fulfill({response});}catch{await route.fulfill({status:503,json:{error:'unavailable'}});}});
 for(const [path,name] of [['/','home'],['/recruiting?team=2633','recruiting'],['/transfers?team=2633','portal'],['/teams','teams'],['/pulse','pulse'],['/playoffs','playoffs'],['/team/2633','team'],['/scenarios#scenario-editor','scenarios']].filter(([,name])=>!(name==='scenarios'&&process.env.SKIP_SCENARIOS==='1')&&(!process.env.QA_PAGES||process.env.QA_PAGES.split(',').includes(name)))){
  const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:90000});assert.ok(response?.ok(),name+' page HTTP status');await page.locator('.shell').waitFor();await page.waitForTimeout(1800);await page.locator('h1').waitFor();
  if(name==='home'){gameHref=await page.locator('.compactGameBottom a').first().getAttribute('href').catch(()=>'');await page.locator('.compactGame').first().waitFor({timeout:30000}).catch(()=>{});assert.equal(await page.locator('.shell').getAttribute('data-appearance'),'dark');const search=page.locator('.gamesExplorer input[type=search]');await search.fill('no-such-program-123');await page.getByRole('button',{name:'Show this week’s All FBS games',exact:true}).click();await search.fill('');}
  if(name==='teams'){assert.equal(await page.locator('.teamDirectory article').count(),138);await page.getByRole('searchbox',{name:'Search teams',exact:true}).fill('Tennessee Volunteers');assert.equal(await page.locator('.teamDirectory article').count(),1);await page.getByRole('searchbox',{name:'Search teams',exact:true}).fill('');}
  if(name==='recruiting'){await page.locator('.prospectCard').first().waitFor({timeout:15000}).catch(()=>{});assert.ok(await page.getByRole('heading',{name:'Tennessee Volunteers',exact:true}).count());}
  if(name==='team'){await page.locator('.leaderCard').first().waitFor({timeout:15000}).catch(()=>{});if(await page.locator('.leaderCard').count()){await page.locator('.leaderCard').first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);}}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${label} ${name} overflows`);
  await page.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,left:0,behavior:'instant'});});await page.waitForTimeout(200);await page.screenshot({path:`${out}/${name}-${label}.png`,fullPage:false});
  if(label==='desktop'&&['home','recruiting','teams','pulse','playoffs'].includes(name)){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();results.push({label,name,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));}
 }
 if(gameHref){await page.goto(base+gameHref,{waitUntil:'domcontentloaded',timeout:90000});await page.getByRole('tab',{name:'Stats',exact:true}).waitFor({timeout:30000});await page.getByRole('tab',{name:'Stats',exact:true}).click();await page.getByRole('tab',{name:'Feed',exact:true}).click();await page.screenshot({path:`${out}/game-${label}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${label} game overflows`);}
 // Light preference survives navigation; mobile More remains keyboard dismissible.
 await page.evaluate(()=>localStorage.setItem('fourth-down-appearance','light'));await page.goto(base+'/teams');await page.waitForTimeout(700);assert.equal(await page.locator('.shell').getAttribute('data-appearance'),'light');await page.screenshot({path:`${out}/teams-light-${label}.png`});
 if(label==='mobile'){await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);}
 assert.deepEqual(errors,[],`${label} browser errors`);await browser.close();
}
fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));assert.equal(results.reduce((n,r)=>n+r.violations.length,0),0,'Accessibility violations');
