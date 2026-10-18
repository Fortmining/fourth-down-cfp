import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const url = process.env.TEST_URL || 'http://127.0.0.1:3001';
const browser = await chromium.launch({headless:true});
try {
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 const page = await context.newPage();
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 await page.goto(url);
 await page.locator('.pollStatus').first().waitFor();
 assert.equal(await page.locator('.shell').getAttribute('data-appearance'),'light');
 const originalOutlook=await page.locator('.outlook').innerText().catch(()=> '');
 for(const appearance of ['light','dark']) {
  await page.getByRole('button',{name:appearance === 'light' ? '☀ Light':'☾ Dark',exact:true}).click();
  for(const theme of ['stadium','turf','prime']) {
   await page.getByLabel('Colorway',{exact:true}).selectOption(theme);
   if (process.env.SKIP_AXE) continue;
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   console.log(appearance,theme,JSON.stringify(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
   assert.equal(result.violations.length,0,`${appearance}/${theme} accessibility violations`);
  }
 }
 await page.reload(); await page.locator('.pollStatus').first().waitFor();
 assert.equal(await page.locator('.shell').getAttribute('data-appearance'),'dark');
 assert.equal(await page.getByLabel('Colorway',{exact:true}).inputValue(),'prime');
 await page.getByRole('combobox',{name:/Ranking source/}).selectOption('cfp');
 assert.match(await page.locator('.publishedRankings').innerText(),/No substitute poll/);
 assert.equal(await page.locator('.publishedList li').count(),0);
 assert.equal(await page.locator('.outlook').innerText().catch(()=> ''),originalOutlook);
 await page.getByRole('button',{name:'Compare polls',exact:true}).click();
 assert.ok(await page.locator('.comparison tbody tr').count()>0);
 await page.getByRole('button',{name:'12-team bracket'}).click();
 assert.match(await page.locator('.bracketWarning').innerText(),/not a projected or official/);
 await page.getByRole('button',{name:'☀ Light',exact:true}).click();
 await page.getByLabel('Colorway',{exact:true}).selectOption('stadium');
 for(const width of [390,320]) {
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`horizontal overflow at ${width}`);
 }
 await page.getByRole('button',{name:'Playoff outlook',exact:true}).click();
 await page.getByRole('button',{name:'Rankings',exact:true}).click();
 await page.getByRole('combobox',{name:/Ranking source/}).selectOption('ap');
 await page.screenshot({path:process.env.SCREENSHOT || '/tmp/fd-mobile.png',fullPage:true});
 // Initial total outage and refresh failure both remain explicit.
 await page.route('**/api/live', route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
 await page.reload(); await page.getByText('The scoreboard could not be loaded. Try refreshing.').waitFor();
 await page.unroute('**/api/live');
 await page.getByRole('button',{name:'Refresh scores and rankings'}).click();
 await page.locator('.pollStatus').first().waitFor();
 await page.route('**/api/live', route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
 await page.getByRole('button',{name:'Refresh scores and rankings'}).click();
 await page.getByText(/Last successful data remains visible/).waitFor();
 assert.ok(await page.locator('.publishedList li').count()>0);
 assert.deepEqual(errors,[]);
 console.log('Browser checks passed: persistence, independent rankings, compare, bracket, 320/390px layout, outage recovery.');
} finally { await browser.close(); }
