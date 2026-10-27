import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium,firefox,webkit,devices} from 'playwright';import AxeBuilder from '@axe-core/playwright';
const url=process.env.TEST_URL||'http://127.0.0.1:3020',out=process.env.SHADOW_SCREENSHOTS;if(!out)throw Error('Private screenshot directory required');fs.mkdirSync(out,{recursive:true});
for(const [engine,mobile] of [[chromium,false],[firefox,false],[webkit,true]]){
 const browser=await engine.launch();try{const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1280,height:1000}});const page=await context.newPage();
 const forbidden=[];await page.route('**/api/alerts/**',route=>{forbidden.push(route.request().method()+' '+new URL(route.request().url()).pathname);return route.fulfill({status:503,body:'No push or subscription access in preview browser test'});});
 await page.goto(url+'/private/resumes');await page.getByRole('heading',{name:'Team Resumes',exact:true}).waitFor();await page.getByRole('searchbox',{name:'Find a team'}).fill('Tennessee Volunteers');await page.getByRole('heading',{name:'Tennessee Volunteers',exact:true}).waitFor();
 const card=page.locator('.resumeCard');assert.equal(await card.count(),1);assert.ok(await card.locator('.resumeCardHeading').evaluate(el=>el.getBoundingClientRect().height<180),'Team heading stays compact');assert.match(await card.innerText(),/6-2/);assert.match(await card.innerText(),/resume order/);assert.match(await page.locator('.resumeDisclosure').innerText(),/not official poll rankings/);
 assert.match(await card.locator('h3 a').getAttribute('href'),/^\/team\/2633$/);assert.match(await card.locator('a[href^="/game/"]').first().getAttribute('href'),/^\/game\/\d+$/);
 await card.getByText('Evidence & what comes next',{exact:true}).click();assert.match(await card.innerText(),/not official championship qualification|Conference position is not established/);
 await card.getByRole('button',{name:'Follow Team',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(forbidden.length,0);
 for(const width of [320,390,430,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.getByLabel('Confirmed update',{exact:true}).selectOption({index:1});await page.waitForFunction(()=>document.querySelector('.resumeStatus')?.textContent?.includes('Saved confirmed update'));assert.match(await page.locator('.resumeStatus').innerText(),/not a live source check/);assert.match(await card.innerText(),/#\d+/);
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);
 await page.setViewportSize({width:mobile?390:1280,height:1000});await page.screenshot({path:out+'/current-resume-'+engine.name()+(mobile?'-iphone':'-desktop')+'.png',fullPage:true});
 await page.getByLabel('Confirmed update',{exact:true}).selectOption('current');await page.waitForFunction(()=>!document.querySelector('.resumeStatus')?.textContent?.includes('Saved confirmed update'));
 // An unavailable refresh cannot leave previously shown movement looking current.
 await page.route('**/api/private/resume-current',route=>route.fulfill({status:503,body:'Controlled offline failure'}));await page.getByRole('button',{name:'Refresh view'}).click();await page.locator('p[role="alert"]').waitFor();assert.match(await page.locator('.resumeStatus').innerText(),/movement withheld/);assert.ok(!(await card.innerText()).includes('Up 1 resume positions'));
 console.log(engine.name()+(mobile?' iPhone-sized':' desktop')+': current 2026 record, official/experimental separation, links, follow cancel, safe-area widths, accessibility and failed refresh passed');
 }finally{await browser.close();}
}
