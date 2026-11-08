import {chromium,webkit,devices} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeGameCenter} from '../app/lib/game-center.ts';
const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/arkansas-auburn-field-goal.json',import.meta.url)));
const base=process.env.TEST_URL||'http://127.0.0.1:3040',out=process.env.REFRESH_RESULTS||'/tmp/fd-refresh-browser';fs.mkdirSync(out,{recursive:true});
const results=[];
for(const [engine,mobile] of [[chromium,false],[webkit,true]]){
 const browser=await engine.launch(),context=await browser.newContext(mobile?{...devices['iPhone 13']}:{viewport:{width:1440,height:1000}}),page=await context.newPage();let calls=0,playerLoads=0,writes=0,final=false;const errors=[],times=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://tunein.com/embed/player/**',r=>{playerLoads++;return r.fulfill({contentType:'text/html',body:'<button>Private player persistence fixture</button>'});});
 function packet(){const center=normalizeGameCenter(structuredClone(fixture));center.teamStats=[{teamId:'2',name:'Auburn Tigers',stats:[{label:'Refresh evidence',value:String(calls)}]}];center.drives[0].plays[0].text=`Private refresh replay ${calls}`;return {center,observedAt:new Date().toISOString(),game:{id:'401856738',name:'Arkansas Razorbacks at Auburn Tigers',status:final?'post':'in',detail:`Replay ${calls}`,date:'2026-11-07T17:00Z',teams:[{id:'2633',name:'Tennessee Volunteers',homeAway:'home'},{id:'2',name:'Auburn Tigers',homeAway:'away'}]}};}
 await page.route('**/api/**',r=>{if(r.request().method()!=='GET'){writes++;return r.fulfill({status:403});}const path=new URL(r.request().url()).pathname;if(path==='/api/games/401856738'){calls++;times.push(Date.now());return r.fulfill({json:packet()});}if(path==='/api/live')return r.fulfill({json:{games:[packet().game],polls:[],warnings:[],updatedAt:new Date().toISOString()}});return r.fulfill({status:404});});
 await page.goto(base+'/game/401856738',{waitUntil:'domcontentloaded'});await page.locator('.gcCast').waitFor();await page.getByRole('button',{name:'Tennessee Football',exact:true}).click();await page.locator('.gameRadio iframe').waitFor();await page.locator('.gameRadio iframe').evaluate(n=>{window.__radioNode=n;});
 await page.getByRole('tab',{name:'Team Stats',exact:true}).click();await page.locator('.gcTeamStats').scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY),initial=calls;
 await page.waitForFunction(n=>document.querySelector('.gcTeamStats dd')?.textContent!==String(n),initial,{timeout:22000});
 const first=calls;await page.waitForFunction(n=>document.querySelector('.gcTeamStats dd')?.textContent!==String(n),first,{timeout:22000});
 assert.ok(calls>=initial+2);assert.equal(await page.getByRole('tab',{name:'Team Stats',exact:true}).getAttribute('aria-selected'),'true');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<3,'Refresh must preserve scroll');assert.equal(await page.locator('.gameRadio iframe').evaluate(n=>n===window.__radioNode),true);assert.equal(playerLoads,1);
 await page.getByRole('tab',{name:'Plays',exact:true}).click();assert.match(await page.locator('.gcCast').innerText(),new RegExp(`Private refresh replay ${calls}`));
 await page.locator('.gcCast').screenshot({path:`${out}/${mobile?'iphone-webkit':'desktop-chromium'}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 final=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelector('.gcBroadcast')?.textContent.includes('Replay'));await page.waitForTimeout(500);const finalCalls=calls;await page.waitForTimeout(16000);assert.equal(calls,finalCalls,'Final game must stop polling');
 assert.deepEqual(errors,[]);assert.equal(writes,0);results.push({browser:engine.name(),automaticRefreshes:2,intervalsMs:times.slice(1,3).map((t,i)=>t-times[i]),newPlaysAndStats:true,tabPreserved:true,scrollPreserved:true,radioIframePreserved:true,playerLoads,finalPollingStopped:true,overflow:false,apiWrites:writes,errors});await browser.close();
}
fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
