import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit,devices} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const base=process.env.TEST_URL||'http://127.0.0.1:3075';
const out=process.env.TEST_OUTPUT;
assert.ok(out&&/^http:\/\/127\.0\.0\.1:\d+$/.test(base),'Explicit local release target required');
fs.mkdirSync(out,{recursive:true});
const actual=await fetch(base+'/api/news-pulse/intelligence/2633').then(r=>r.json());
assert.ok(actual.available&&actual.view.datasets.playerStats);
const results=[];
for(const [engine,mobile] of [[chromium,false],[webkit,true]]){
 const browser=await engine.launch();
 try{
  const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
  const errors=[],writes=[],credentialHeaders=[];let scenario='live';
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==base)return route.abort();
   if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push(url.pathname);return route.abort();}
   if(Object.keys(req.headers()).some(h=>/^cf-access-|^authorization$/i.test(h)))credentialHeaders.push(url.pathname);
   if(url.pathname==='/api/news-pulse/intelligence/2633'&&scenario!=='live'){
    if(scenario==='offline')return route.fulfill({status:503,json:{available:false}});
    const packet=structuredClone(actual);
    if(scenario==='stale')packet.stale=true;
    if(scenario==='missing')delete packet.view.datasets.playerStats;
    return route.fulfill({json:packet});
   }
   if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/news-pulse'))return route.fulfill({status:503,json:{available:false}});
   return route.continue();
  });
  const open=async desk=>{await page.goto(base+'/pulse?team=2633',{waitUntil:'domcontentloaded'});await page.getByLabel('Coverage desk').selectOption(desk);};
  await open('team');
  await page.getByText(/players listed on the roster/).waitFor();
  await page.getByText('Season yardage leaders',{exact:true}).click();
  assert.ok((await page.locator('section[aria-label="Team observations"]').innerText()).includes(' yards'));
  await page.getByLabel('Compare with').selectOption('61');
  await page.locator('section[aria-label="Team observations"]').getByRole('heading',{name:'Georgia Bulldogs',exact:true}).waitFor();
  for(const width of mobile?[320,390,430]:[1280,1440]){
   await page.setViewportSize({width,height:mobile?844:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+width);
  }
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  await page.setViewportSize({width:mobile?390:1440,height:mobile?844:1000});
  await page.screenshot({path:out+'/'+engine.name()+'-scouting.png',fullPage:true});
  await open('recruiting');await page.getByText(/reported commitments/).first().waitFor();
  await page.getByText(/Class ranking is currently unavailable for 2027/).waitFor();
  await page.screenshot({path:out+'/'+engine.name()+'-recruiting.png',fullPage:true});
  await open('portal');await page.getByRole('heading',{name:/Reported destinations/}).waitFor();
  assert.ok((await page.locator('section[aria-label="Team observations"]').innerText()).includes('Historical season records'));
  scenario='missing';await open('team');await page.getByText(/Season yardage leaders are currently unavailable/).waitFor();
  scenario='stale';await open('team');await page.getByText(/Showing the last verified team records/).waitFor();
  scenario='offline';await open('team');await page.getByText('No sourced edition available for this team and view.',{exact:true}).waitFor();
  scenario='live';await open('team');await page.getByText(/players listed on the roster/).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(credentialHeaders,[]);
  results.push({engine:engine.name(),iphoneSized:mobile,realOriginData:true,playerLeaders:true,teamComparison:true,recruiting:true,classRankingUnavailable:true,historicalTransfers:true,controlledMissingDataset:true,controlledStale:true,controlledOutageRecovery:true,accessibility:true,noOverflow:true,noCredentialHeaders:true,noWrites:true,physicalDevice:false});
  fs.writeFileSync(out+'/browser-results.json',JSON.stringify(results,null,2));
  console.log(engine.name()+' release flow passed with real CFBD summaries and controlled failure states');
 }catch(error){const page=browser.contexts()[0]?.pages()[0];if(page){await page.screenshot({path:out+'/'+engine.name()+'-failure.png',fullPage:true});console.log('Release browser failure page:',(await page.locator('body').innerText()).slice(0,1600));}throw error;}finally{await browser.close();}
}
