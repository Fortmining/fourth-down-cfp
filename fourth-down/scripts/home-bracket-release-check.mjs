import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit,devices} from 'playwright';
const base=process.env.TEST_URL||'http://localhost:3018',out='/tmp/fd-national-release';fs.mkdirSync(out,{recursive:true});
const api=new Map();
for(const path of ['/api/live','/api/resumes','/api/news-pulse']){const r=await fetch('https://fourth-down-cfp.vercel.app'+path);api.set(path,{status:r.status,body:await r.text()});}
const results=[];
for(const [engine,options,label] of [[chromium,{viewport:{width:1440,height:1000}},'desktop'],[webkit,devices['iPhone 13'],'iphone']]){
 const browser=await engine.launch(),context=await browser.newContext({...options,timezoneId:'America/New_York'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;if(api.has(path))return route.fulfill({...api.get(path),contentType:'application/json'});if(path.startsWith('/api/private/'))return route.continue();return route.fulfill({status:503,json:{error:'Not requested by this focused check'}});});
 for(const path of ['/','/playoffs','/recruiting?team=333']){
  await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+path+' overflow');
  if(path==='/'){assert.equal(await page.locator('.scoreTicker').count(),1);assert.equal(await page.locator('.gamesExplorer').count(),0);assert.equal(await page.getByRole('heading',{name:'Games That Matter'}).count(),0);assert.ok(await page.getByRole('link',{name:'Home',exact:true}).count());}
  if(path==='/playoffs'){
   assert.equal(await page.locator('.bracketNode').count(),11);assert.equal(await page.locator('.bracketCanvas svg path').count(),10);
   await page.getByRole('button',{name:'What If',exact:true}).click();const nodes=page.locator('.bracketNode.round0 button:not(:disabled)');assert.ok(await nodes.count()>0,'real published poll fills field');await nodes.first().click();await page.getByRole('dialog').waitFor();const advance=page.getByRole('button',{name:/^Advance /}).first();await advance.click();await page.getByRole('button',{name:'Close matchup'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.ok(await page.locator('.bracketNode button[aria-pressed=true]').count()>0);await page.getByRole('button',{name:'Reset picks',exact:true}).click();assert.equal(await page.locator('.bracketNode button[aria-pressed=true]').count(),0);
   await page.getByRole('button',{name:'Official',exact:true}).click();assert.ok(await page.getByText('OFFICIAL FIELD PENDING',{exact:true}).count());await page.getByRole('button',{name:'Projected',exact:true}).click();
  }
  if(path.includes('recruiting'))assert.ok((await page.locator('.programHero img').getAttribute('src')).endsWith('/333.png'));
  await page.screenshot({path:`${out}/${path==='/'?'home':path.includes('playoffs')?'bracket':'alabama'}-${label}.png`,fullPage:false});
 }
 await page.goto(base+'/pulse',{waitUntil:'networkidle'});const articles=page.locator('h3 .articleReadButton');
 if(await articles.count()){
  await articles.first().scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY),url=page.url();await articles.first().click();await page.getByRole('dialog').waitFor();await page.getByRole('link',{name:'Open Original',exact:true}).waitFor();await page.getByRole('button',{name:'Preview not working?',exact:true}).click();await page.getByRole('heading',{name:/Continue with/}).waitFor();await page.getByRole('button',{name:'Back to Fourth Down',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(page.url(),url);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<5,'article preserves scroll');
  await articles.first().click();await page.getByRole('dialog').waitFor();await page.goBack();await page.getByRole('dialog').waitFor({state:'hidden'});
 }else throw Error('No verified article available for viewer check');
 for(const [appearance,theme] of [['light','stadium'],['dark','blue']]){await page.evaluate(([a,t])=>{localStorage.setItem('fourth-down-appearance',a);localStorage.setItem('fourth-down-theme',t);},[appearance,theme]);await page.goto(base+'/playoffs',{waitUntil:'networkidle'});assert.equal(await page.locator('.shell').getAttribute('data-appearance'),appearance);assert.equal(await page.locator('.shell').getAttribute('data-theme'),theme);await page.screenshot({path:`${out}/bracket-${appearance}-${theme}-${label}.png`});}
 const denied=await context.request.get(base+'/api/private/odds?date=2026-11-26');assert.equal(denied.status(),404);assert.deepEqual(errors,[],label+' browser errors');results.push({label,home:'pass',bracket:'pass',viewer:'pass',logos:'pass',themes:'pass',privateOdds:'404'});await browser.close();
}
fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
