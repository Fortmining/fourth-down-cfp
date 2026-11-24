import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit,devices} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const base=process.env.TEST_URL||'http://127.0.0.1:3076',out=process.env.TEST_OUTPUT;
assert.ok(out&&/^http:\/\/127\.0\.0\.1:\d+$/.test(base),'Explicit isolated local target required');
fs.mkdirSync(out,{recursive:true});
const actual=await fetch('https://fourth-down-cfp.vercel.app/api/news-pulse/events').then(r=>r.json());
assert.ok(actual.events.length>=7);fs.writeFileSync(out+'/captured-production-records.json',JSON.stringify(actual,null,2));
const now=Date.now(),today=new Date(now).toISOString().slice(0,10),day=new Date(now-2*86400000).toISOString().slice(0,10);
const prefs=(favorites,items=[])=>({version:1,favorites,myTeams:{enabled:false},breaking:{enabled:false},following:{enabled:false,items}});
const tn=prefs([{id:'2633',name:'Tennessee Volunteers'}]);
const peers=prefs([{id:'61',name:'Georgia Bulldogs'}],[{kind:'team',id:'2483',name:'Oregon Ducks',duration:'7d',createdAt:now-1000,expiresAt:now+86400000},{kind:'team',id:'2633',name:'Tennessee Volunteers',duration:'7d',createdAt:now-2000,expiresAt:now-1},{kind:'team',id:'333',name:'Alabama Crimson Tide',duration:'7d',createdAt:now+86400000,expiresAt:now+172800000}]);
const fixture=(id,name)=>({...actual.events[0],id:'controlled:'+id,school:{id,name},from:undefined,player:{id:'controlled:'+id,name:'TEST ONLY '+name+' recent event',position:'QB'},kind:'recruit-commitment',eventDate:day,precision:'day',source:{publisher:'Controlled test source',url:'https://example.org/test/'+id,verification:'official',observedOn:today}});
const controlled={...actual,events:[...actual.events,fixture('61','Georgia'),fixture('2483','Oregon'),fixture('2633','Tennessee'),fixture('333','Alabama')]};
const results=[];
for(const [engine,mobile] of [[chromium,false],[webkit,true]]){
 const browser=await engine.launch();const errors=[],writes=[];
 try{
  const open=async(preferences,packet=actual)=>{
   const context=await browser.newContext({...mobile?devices['iPhone 13']:{viewport:{width:1440,height:1000}},serviceWorkers:'block'});
   await context.addInitScript(p=>localStorage.setItem('fourth-down-alert-preferences-v1',JSON.stringify(p)),preferences);
   const page=await context.newPage();page.setDefaultTimeout(20000);await page.clock.install({time:new Date(now)});
   let failure=false;
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push(url.pathname);return route.abort();}
    if(url.origin!==base)return route.abort();
    if(url.pathname==='/api/news-pulse/events')return route.fulfill({status:failure?503:200,json:failure?{error:'Controlled outage'}:packet});
    if(url.pathname==='/api/news-pulse')return route.fulfill({json:{version:1,mode:'unavailable',evaluatedAt:new Date(now).toISOString(),items:[],sources:[],pushDelivery:false}});
    if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{available:false}});
    return route.continue();
   });
   await page.goto(base+'/pulse?view=for-you',{waitUntil:'domcontentloaded'});
   const section=page.locator('section[aria-label="Reviewed player events"]');await section.waitFor();
   return {page,context,section,fail:()=>{failure=true;},recover:()=>{failure=false;}};
  };
  const a=await open(tn);const recent=a.section.locator('[aria-label="Recent player updates"]');
  await recent.getByText(/No recent verified player updates are available/).waitFor();assert.equal(await recent.locator('li').count(),0);
  assert.equal(await a.section.locator('details').getAttribute('open'),null);
  await a.page.screenshot({path:out+'/'+engine.name()+'-recent-empty.png',fullPage:true});
  await a.section.getByText('Player record history ('+actual.events.length+')',{exact:true}).click();
  assert.equal(await a.section.locator('details li').count(),actual.events.length);
  await a.section.locator('details').getByText(/2025-12-03/).first().waitFor();await a.section.locator('details').getByText(/2026-01/).first().waitFor();
  await a.page.screenshot({path:out+'/'+engine.name()+'-history.png',fullPage:true});
  a.fail();await a.page.clock.fastForward(600001);await a.section.getByText(/Recent player updates are unavailable/).first().waitFor();
  assert.equal(await recent.locator('li').count(),0);assert.equal(await a.section.locator('details li').count(),actual.events.length);
  a.recover();await a.page.clock.fastForward(600001);await recent.getByText(/No recent verified player updates are available/).waitFor();
  await a.context.close();
  const b=await open(peers);await b.section.getByText(/Recent player updates are unavailable for these teams/).waitFor();
  await b.section.getByText('Your teams: Georgia Bulldogs, Oregon Ducks.',{exact:true}).waitFor();assert.equal(await b.section.locator('li').count(),0);
  await b.page.screenshot({path:out+'/'+engine.name()+'-other-teams.png',fullPage:true});await b.context.close();
  const c=await open(peers,controlled);const current=c.section.locator('[aria-label="Recent player updates"]');await current.getByText('TEST ONLY Georgia recent event',{exact:true}).waitFor();
  assert.equal(await current.locator('li').count(),2);await current.getByText('TEST ONLY Oregon recent event',{exact:true}).waitFor();
  assert.equal(await current.getByText('TEST ONLY Tennessee recent event',{exact:true}).count(),0);assert.equal(await current.getByText('TEST ONLY Alabama recent event',{exact:true}).count(),0);
  for(const width of mobile?[320,390,430]:[1280,1440]){await c.page.setViewportSize({width,height:mobile?844:1000});assert.ok(await c.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  const axe=await new AxeBuilder({page:c.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);await c.context.close();
  const d=await open(prefs([{id:'213',name:'Penn State Nittany Lions'}]));await d.section.locator('[aria-label="Recent player updates"]').getByText(/No recent verified player updates are available/).waitFor();
  const psu=actual.events.filter(e=>e.school.id==='213'||e.from?.id==='213').length;assert.ok(psu>0);await d.section.getByText('Player record history ('+psu+')',{exact:true}).click();assert.equal(await d.section.locator('details li').count(),psu);await d.context.close();
  const e=await open(prefs([]));await e.section.getByText('Follow a team or choose a favorite to see its player updates.',{exact:true}).waitFor();assert.equal(await e.section.locator('li').count(),0);await e.context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  results.push({engine:engine.name(),iphoneSized:mobile,realHistoricalRecords:actual.events.length,noHistoricalRecordsInRecent:true,historyPreserved:true,activeFavoriteAndTemporaryTeamScope:true,expiredAndFutureFollowsExcluded:true,otherTeamsUnavailable:true,pennStateHistoricalDepartures:true,controlledRecentFixtures:true,outageAndRecovery:true,noTeamsState:true,accessibility:true,noOverflow:true,noWrites:true,physicalDevice:false});
  fs.writeFileSync(out+'/browser-results.json',JSON.stringify(results,null,2));console.log(engine.name()+': historical separation, multi-team scope, unavailable/empty states and recovery passed');
 }catch(error){const page=browser.contexts().flatMap(c=>c.pages()).at(-1);if(page){await page.screenshot({path:out+'/'+engine.name()+'-failure.png',fullPage:true});console.log((await page.locator('body').innerText()).slice(0,1800));}throw error;}finally{await browser.close();}
}
