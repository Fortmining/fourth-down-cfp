import {chromium,webkit,devices} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeGameCenter} from '../app/lib/game-center.ts';
const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/arkansas-auburn-field-goal.json',import.meta.url)));
const base=process.env.TEST_URL||'http://127.0.0.1:3039',out=process.env.GOALKICK_RESULTS||'/tmp/fd-goalkicks';fs.mkdirSync(out,{recursive:true});const results=[];
for(const [engine,mobile]of [[chromium,false],[webkit,true]]){
 const browser=await engine.launch(),context=await browser.newContext(mobile?{...devices['iPhone 13'],viewport:{width:390,height:844}}:{viewport:{width:1440,height:1100}}),page=await context.newPage();let mode='captured',writes=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 function packet(){const raw=structuredClone(fixture),p=raw.drives.previous[0].plays[0];if(mode==='right'){p.start.team.id='2';p.end.team.id='2';}if(mode==='missed'){p.type.text='Field Goal Missed';p.text='Private rendering check: field goal missed. Landing position unavailable.';p.scoringPlay=false;}const center=normalizeGameCenter(raw);return {center,observedAt:new Date().toISOString(),game:{id:'401856738',name:'Arkansas Razorbacks at Auburn Tigers',status:'in',detail:'9:32 · 4th',date:'2026-11-07T17:00Z',teams:center.teams.map(t=>({...t,homeAway:t.id==='2'?'home':'away'}))}};}
 await page.route('**/api/**',r=>{if(r.request().method()!=='GET'){writes++;return r.fulfill({status:403});}const path=new URL(r.request().url()).pathname,d=packet();return path==='/api/live'?r.fulfill({json:{games:[d.game],polls:[],warnings:[],updatedAt:d.observedAt}}):path==='/api/games/401856738'?r.fulfill({json:d}):r.fulfill({status:404});});
 await page.goto(base+'/game/401856738',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('.gcGoalTarget').waitFor();await page.locator('.gcCast').scrollIntoViewIfNeeded();await page.waitForTimeout(1300);
 assert.match(await page.locator('.gcAerialTracer').getAttribute('d'),/0 15$/);assert.equal(await page.locator('.gcGoalpost').count(),2);assert.match(await page.locator('.gcSituation').innerText(),/awaiting next possession/);assert.match(await page.locator('.gcPlayHeadline').innerText(),/Before kick · 4th & 6 at AUB 28/);assert.match(await page.locator('.gcPlayMeta').innerText(),/PREVIOUS PLAY/);
 await page.locator('.gcCast').screenshot({path:out+`/captured-kick-${mobile?'iphone':'desktop'}.png`});
 await page.locator('.gcPlays button').first().click();
 async function animationPosition(seconds){return page.locator('.gcFieldPlane svg').evaluate(async(svg,seconds)=>{svg.pauseAnimations();svg.setCurrentTime(seconds);await new Promise(requestAnimationFrame);const matrix=svg.querySelector('.gcBall').getCTM();return {x:matrix.e,y:matrix.f};},seconds);}
 const startTime=await page.locator('.gcBall animateMotion').evaluate(n=>n.getStartTime());
 const early=await animationPosition(startTime+.1),late=await animationPosition(startTime+1.05);assert.ok(late.x<early.x-10,'Football must advance toward left uprights');
 await page.getByRole('button',{name:'Latest play',exact:true}).click();
 const axe=await new AxeBuilder({page}).include('.gcCast').analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);
 mode='right';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.gcGoalTarget[cx="120"]').waitFor();await page.waitForTimeout(1300);await page.locator('.gcCast').screenshot({path:out+`/opposite-direction-${mobile?'iphone':'desktop'}.png`});assert.match(await page.locator('.gcAerialTracer').getAttribute('d'),/120 15$/);
 mode='missed';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByText('Kick missed · flight path unavailable',{exact:true}).waitFor();assert.equal(await page.locator('.gcAerialTracer').count(),0);assert.match(await page.locator('.gcSituation').innerText(),/Kick missed/);assert.match(await page.locator('.gcPlayHeadline').innerText(),/46[\s\S]*KICK YDS/);assert.doesNotMatch(await page.locator('.gcPlayHeadline').innerText(),/\+46/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(mobile){await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('.gcCast').screenshot({path:out+'/missed-kick-375.png'});}
 for(const name of ['Drives','Team Stats','Players','Plays'])await page.getByRole('tab',{name,exact:true}).click();assert.deepEqual(errors,[]);assert.equal(writes,0);results.push({browser:engine.name(),mobile,capturedArkansasKick:true,bothGoalDirections:true,missDestinationWithheld:true,previousPlayExplicit:true,axeViolations:0,overflow:false,apiWrites:writes,errors});await browser.close();
}
fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
