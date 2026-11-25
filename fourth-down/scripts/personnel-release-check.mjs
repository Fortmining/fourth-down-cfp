import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit,devices} from 'playwright';
const base=process.env.TEST_URL||'http://localhost:3020',out='/tmp/fd-personnel-release';fs.mkdirSync(out,{recursive:true});
const packets=new Map();
for(const path of ['/api/live','/api/news-pulse','/api/news-pulse/intelligence/2633']){const r=await fetch('https://fourth-down-cfp.vercel.app'+path);packets.set(path,{status:r.status,body:await r.text()});}
const results=[];
for(const [engine,options,label] of [[chromium,{viewport:{width:1440,height:1000}},'desktop'],[webkit,devices['iPhone 13'],'iphone']]){
 const browser=await engine.launch();try{const context=await browser.newContext({...options,timezoneId:'America/New_York'});if(process.env.PREVIEW_SHARE_URL){const entry=await context.request.get(process.env.PREVIEW_SHARE_URL);assert.equal(entry.status(),200);}
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;requests.push(path);if(packets.has(path))return route.fulfill({...packets.get(path),contentType:'application/json'});return route.fulfill({status:503,json:{error:'Not needed for this read-only check'}});});
 await page.goto(base+'/',{waitUntil:'networkidle'});assert.equal(requests.includes('/api/resumes'),false,'Home avoids unused resume requests');assert.equal(await page.locator('.scoreTicker').count(),1);
 if(label==='desktop'){await page.getByRole('searchbox',{name:'Search teams',exact:true}).fill('Delaware');assert.ok(await page.getByRole('link',{name:/Delaware Blue Hens/}).count(),'Full registry search works without resume packet');}
 await page.goto(base+'/recruiting?team=2633',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Tennessee Volunteers',exact:true}).waitFor();assert.equal(await page.getByLabel('Scouting team',{exact:true}).count(),0,'No duplicate team picker');
 const selector=page.getByRole('combobox',{name:'Choose a program',exact:true});
 if(label==='iphone'){assert.equal(await selector.locator('option').count(),139);assert.equal(await page.locator('.programList').isVisible(),false);await page.getByRole('searchbox',{name:'Search programs',exact:true}).fill('Alabama');assert.ok((await selector.locator('option').count())<10);assert.equal(await selector.inputValue(),'2633','Filtered picker retains selected program');await page.getByRole('searchbox',{name:'Search programs',exact:true}).fill('');}
 const preview=page.locator('.scoutingPanel .personnelPreviewNote').first();await preview.waitFor({timeout:15000});assert.match(await preview.textContent(),/not the full class/);const rows=page.locator('.prospectCard');assert.ok(await rows.count()>0&&await rows.count()<=5);assert.ok((await rows.first().boundingBox()).height<125,'Compact player rows');
 await page.screenshot({path:`${out}/recruiting-${label}.png`});
 await page.locator('.personnelTabs').getByRole('link',{name:'Transfer Portal',exact:true}).click();await page.waitForURL(/\/transfers\?team=2633/);await page.getByRole('heading',{name:'Tennessee Volunteers',exact:true}).waitFor();
 await page.locator('.personnelTabs').getByRole('link',{name:'Recruiting',exact:true}).click();await page.waitForURL(/\/recruiting\?team=2633/);await page.getByRole('heading',{name:'Tennessee Volunteers',exact:true}).waitFor();
 if(label==='iphone')await selector.selectOption('333');else{await page.getByRole('searchbox',{name:'Search programs',exact:true}).fill('Alabama Crimson');await page.locator('.programList button').first().click();}
 await page.getByRole('heading',{name:'Alabama Crimson Tide',exact:true}).waitFor();assert.ok((await page.locator('.programHero img').getAttribute('src')).endsWith('/333.png'));assert.ok((await page.locator('.programDestinations').getByRole('link',{name:/Transfer Portal/}).getAttribute('href')).endsWith('?team=333'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' overflow');assert.ok(!requests.some(p=>p.startsWith('/api/private/odds')),'No odds polling');assert.deepEqual(errors,[]);results.push({label,registrySearch:'passed',programContext:'passed',compactPreview:'passed',homeResumeRequests:0,oddsRequests:0});
 }finally{await browser.close();}
}
fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
