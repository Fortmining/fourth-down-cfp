import {chromium,webkit,devices} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.BASE_URL||'http://127.0.0.1:3043';
const real=process.env.LIVE==='1';
const out=process.env.OUTPUT_DIR||'/Users/rick/Documents/ChatGPT/Fourth Down/outputs/playoff-blue-20261125';
fs.mkdirSync(out,{recursive:true});
const capture=JSON.parse(fs.readFileSync(new URL('./data/playoff-ui-production-20261125.json',import.meta.url)));
const results=[];
for(const [engine,mobile] of [[chromium,false],[webkit,true]]){
 const browser=await engine.launch();
 const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1440,height:1100}});
 // Keep captured fixture games future-facing when this regression is run later.
 if(!real)await context.clock.setFixedTime(new Date(capture.sandbox.catalog.at));
 const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[],writes=[],cancelled=[];console.log(engine.name(), 'starting',real?'live':'fixture');
 page.on('pageerror',e=>errors.push({message:e.message,at:Date.now()}));
 page.on('requestfailed',request=>{const url=new URL(request.url());if(url.origin===new URL(base).origin&&url.pathname.startsWith('/api/')&&/^cancelled$|^canceled$/i.test(request.failure()?.errorText||''))cancelled.push({url,at:Date.now()});});
 // Observe live traffic without changing browser networking; mock only fixture traffic.
 if(real)page.on('request',request=>{if(request.url().includes('/api/')&&request.method()!=='GET')writes.push(request.url());});
 if(!real)await page.route('**/api/**',async route=>{
  const request=route.request();if(request.method()!=='GET'){writes.push(request.url());return route.abort();}
  if(!real){const path=new URL(request.url()).pathname;
   if(path==='/api/live')return route.fulfill({json:capture.live});
   if(path==='/api/scenario-sandbox')return route.fulfill({json:capture.sandbox});
   // Unrelated feeds are deliberately unavailable in this focused fixture test.
   return route.fulfill({status:503,json:{status:'unavailable'}});
  }return route.continue();
 });
 await page.goto(base+'/playoffs',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByRole('navigation',{name:'Playoff analysis'}).getByRole('link',{name:'What If & bracket',exact:true}).click();
 const lab=page.getByRole('region',{name:'Playoff predictor',exact:true});
 await lab.getByRole('region',{name:'Interactive playoff bracket'}).waitFor({timeout:45000});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.outlookRounds')).display==='grid');
 if(mobile){
  await lab.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  const visible=await lab.locator('.outlookWorkspace .sandboxGame').first().getByRole('button').last().evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight-(document.querySelector('.mobileTrackerNav')?.getBoundingClientRect().height||0));
  assert.equal(visible,true,'both first-game outcomes should appear above the mobile navigation');
 }
 assert.equal(await lab.locator('.outlookField li').count(),12);
 assert.equal(await lab.getByLabel('SEC champion assumption',{exact:true}).isVisible(),true);
 const initial=await lab.locator('.outlookField').innerText();
 const quick=lab.getByRole('region',{name:'Quick game outcomes'});
 const first=quick.getByRole('button').first();await first.click();
 assert.equal(await first.getAttribute('aria-pressed'),'true');
 assert.match(await lab.locator('.outlookFeedback').innerText(),/1 game outcome selected/);
 assert.match(await first.innerText(),/→/);
 await first.click();assert.equal(await first.getAttribute('aria-pressed'),'false');
 // Use a real ranked champion outside the initial field to prove auto-bid displacement.
 const options=await lab.getByLabel('SEC champion assumption',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>({id:n.value,name:n.textContent})));
 const live=real?await page.evaluate(()=>fetch('/api/live').then(r=>r.json())):capture.live;
 const poll=live.polls.find(p=>p.id==='cfp'&&p.teams.length===25)||live.polls.find(p=>p.teams.length===25);
 const candidate=options.find(o=>o.id&&poll.teams.some(t=>t.teamId===o.id)&&!initial.includes(o.name));
 assert.ok(candidate,'real fixture must offer a ranked SEC champion outside starting field');
 await lab.getByLabel('SEC champion assumption',{exact:true}).selectOption(candidate.id);
 assert.ok((await lab.locator('.outlookField').innerText()).includes(candidate.name));
 assert.match(await lab.locator('.outlookFeedback').innerText(),/Field change/);
 assert.notEqual(await lab.locator('.outlookField').innerText(),initial);
 const rounds=lab.locator('.outlookRounds');
 await rounds.getByRole('region',{name:'First round',exact:true}).getByRole('button').first().click();
 assert.equal(await rounds.getByRole('region',{name:'Quarterfinals',exact:true}).getByRole('button',{disabled:false}).count(),2);
 const qf=rounds.getByRole('region',{name:'Quarterfinals',exact:true}).getByRole('button',{disabled:false}).last();await qf.click();
 await rounds.getByRole('region',{name:'First round',exact:true}).getByRole('button').nth(1).click();
 assert.equal(await rounds.getByRole('region',{name:'Quarterfinals',exact:true}).locator('button[aria-pressed=true]').count(),0);
 if((await lab.locator('.outlookUnknown').count())){
  assert.equal(await lab.getByRole('button',{name:'Simulate Once',exact:true}).isDisabled(),true);
  assert.equal(await lab.locator('.outlookOdds').count(),0);
 }
 const rep=lab.getByLabel('Six-conference representative assumption',{exact:true});
 const repId=await rep.locator('option').nth(1).getAttribute('value');await rep.selectOption(repId);
 assert.match(await lab.locator('.outlookField').innerText(),/Your qualifier assumption/);
 await page.reload();await lab.waitFor();await lab.locator('.outlookField').waitFor();
 assert.equal(await lab.getByLabel('Six-conference representative assumption',{exact:true}).inputValue(),repId);
 page.once('dialog',d=>d.accept());await lab.getByRole('button',{name:'Reset All',exact:true}).click();
 assert.equal(await rep.inputValue(),'');assert.equal(await lab.locator('.outlookField').innerText(),initial);
 const checkbox=lab.getByRole('checkbox');await checkbox.uncheck();
 assert.match(await lab.innerText(),/Acknowledge that postseason eligibility/);
 assert.equal(await quick.getByRole('button').first().isVisible(),true);await checkbox.check();
 console.log(engine.name(),'scenario controls passed');
 // Set blue using the actual settings controls, then navigate and reload.
 await page.goto(base+'/settings',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Make it yours',exact:true}).waitFor();
 await page.getByLabel('Theme',{exact:true}).selectOption('blue');
 console.log(engine.name(),'selected blue');
 await page.waitForFunction(()=>localStorage.getItem('fourth-down-theme')==='blue');
 for(const appearance of ['light','dark']){
  await page.getByLabel('Appearance',{exact:true}).selectOption(appearance);
  await page.goto(base+'/scenarios#bracket',{waitUntil:'domcontentloaded'});
  await lab.locator('.outlookRounds').waitFor({timeout:45000});
  await page.waitForFunction(()=>document.querySelector('.shell')?.dataset.theme==='blue');
  assert.equal(await page.locator('.shell').getAttribute('data-theme'),'blue');
  assert.equal(await page.locator('.shell').getAttribute('data-appearance'),appearance);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(engine.name(),appearance,'appearance persisted');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.outlookRounds')).display==='grid');
  const axe=await new AxeBuilder({page}).include('#main-content').analyze();
  assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  await lab.locator('.outlookInteractive').screenshot({path:`${out}/${real?'production':'fixture'}-${mobile?'mobile':'desktop'}-${appearance}-bracket.png`});
  await lab.screenshot({path:`${out}/${real?'production':'fixture'}-${mobile?'mobile':'desktop'}-${appearance}.png`});
  await page.goto(base+'/settings',{waitUntil:'domcontentloaded'});
 }
 await page.goto(base+'/team/'+poll.teams[0].teamId,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('.shell')?.dataset.theme==='blue');
 await page.reload();await page.waitForFunction(()=>document.querySelector('.shell')?.dataset.theme==='blue');
 await page.goto(base+'/settings',{waitUntil:'domcontentloaded'});
 await page.reload();await page.waitForFunction(()=>document.querySelector('select[aria-label=Theme]')?.value==='blue');assert.equal(await page.getByLabel('Theme',{exact:true}).inputValue(),'blue');
 if(!real){
  const ranked=structuredClone(capture.live);
  const inventory=JSON.parse(fs.readFileSync(new URL('../app/data/pulse-teams-2026.json',import.meta.url)));
  const known=inventory.teams.find(t=>t.conference==='American Conference'&&!ranked.polls.some(p=>p.teams.some(r=>r.teamId===t.id)));
  for(const poll of ranked.polls)if(poll.teams.length===25){const last=poll.teams.find(t=>t.rank===25);Object.assign(last,{teamId:known.id,name:known.name});}
  await page.route('**/api/live',r=>r.fulfill({json:ranked}));
  await page.goto(base+'/scenarios#bracket');await lab.locator('.outlookOdds tbody tr').first().waitFor();
  assert.equal(await lab.locator('.outlookOdds tbody tr').count(),12);
  await lab.getByRole('button',{name:'Pick Favorites',exact:true}).click();
  assert.equal(await lab.locator('.outlookRounds button[aria-pressed=true]').count(),11);
  await lab.getByRole('button',{name:'Clear Playoff Picks',exact:true}).click();
  assert.equal(await lab.locator('.outlookRounds button[aria-pressed=true]').count(),0);
  await page.route('**/api/live',r=>r.fulfill({json:{...capture.live,polls:[]}}));
  await page.route('**/api/scenario-sandbox',r=>r.fulfill({json:{...capture.sandbox,catalog:{...capture.sandbox.catalog,games:[]}}}));
  await page.reload();await lab.getByText('No verified future fixtures are available. Try a champion assumption instead.').waitFor();
  assert.match(await lab.innerText(),/A complete, untied published Top 25/);
  assert.equal(await lab.getByLabel('SEC champion assumption',{exact:true}).isVisible(),true);
 }
 // Ignore only WebKit access-control messages paired with an explicitly canceled API request at the same time.
 const unexpectedErrors=errors.filter(e=>!(/due to access control checks\.$/.test(e.message)&&cancelled.some(r=>Math.abs(r.at-e.at)<2000&&e.message.includes(r.url.host+r.url.pathname)))).map(e=>e.message);
 assert.deepEqual(unexpectedErrors,[]);assert.deepEqual(writes,[]);
 results.push({engine:engine.name(),mobile,real,field:12,gamePick:true,championDisplacement:true,dependentPicksCleared:true,reset:true,persistence:true,blueLightDark:true,axeViolations:0,errors:unexpectedErrors,cancelledNavigationWarnings:errors.length-unexpectedErrors.length,writes});
 await browser.close();
}
fs.writeFileSync(out+`/${real?'production':'fixture'}-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
