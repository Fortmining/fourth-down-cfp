import {chromium,webkit,devices} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:3001';
const original=process.env.FEED_FIXTURE?JSON.parse(await readFile(process.env.FEED_FIXTURE,'utf8')):await(await fetch(base+'/api/live')).json();
const game=original.games.find(g=>g.status==='pre'&&!g.kickoffTbd);assert.ok(game);const team=game.teams[0];
for(const [engine,device] of [[chromium,null],[webkit,'iPhone 13']]){
 const browser=await engine.launch();
 try{
  const context=await browser.newContext(device?{...devices[device],reducedMotion:'reduce'}:{viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  let feed=structuredClone(original);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(180000);
  await context.addInitScript(()=>{window.__prompts=0;if('Notification' in window)Notification.requestPermission=async()=>{window.__prompts++;return 'denied';};});
  await page.route('**/api/live',r=>r.fulfill({json:feed}));
  await page.goto(`${base}/game/${game.id}`);await page.getByRole('heading',{name:game.name,exact:true,level:1}).waitFor();
  await page.getByRole('button',{name:'Follow Game',exact:true}).click();await page.getByRole('button',{name:'Unfollow',exact:true}).waitFor();
  let prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')));
  assert.equal(prefs.following.items.length,1);assert.equal(prefs.following.enabled,false);assert.deepEqual(prefs.favorites,[]);const expiry=prefs.following.items[0].expiresAt;
  await page.reload();await page.getByRole('button',{name:'Unfollow',exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')).following.items[0].expiresAt),expiry);
  await page.goto(base+'/#watchlist');await page.locator('#watchlist').getByRole('link',{name:game.name,exact:true}).waitFor();
  assert.ok((await page.locator('#watchlist').innerText()).includes(game.teams[1].name));assert.ok((await page.locator('#watchlist').getByRole('link',{name:game.name,exact:true}).getAttribute('href')).startsWith('/game/'));
  await page.goto(`${base}/team/${team.id}`);await page.getByRole('button',{name:'Add favorite',exact:true}).click();
  await page.getByRole('combobox',{name:`Follow duration for ${team.name}`}).selectOption('24h');await page.getByRole('button',{name:'Follow Team',exact:true}).click();await page.getByRole('button',{name:'Unfollow',exact:true}).waitFor();
  prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')));assert.equal(prefs.favorites.length,1);assert.equal(prefs.following.items.length,2);assert.equal(prefs.following.items.find(f=>f.kind==='team').duration,'24h');
  await page.goto(base+'/#following');await page.locator('#following').getByRole('button',{name:`Unfollow ${game.name}`,exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')).following.items.length===1);
  assert.equal(await page.locator('.favoriteChips button').count(),1);
  await page.goto(`${base}/team/${team.id}`);await page.getByRole('button',{name:'Unfollow',exact:true}).click();await page.getByRole('button',{name:'Follow Team',exact:true}).waitFor();
  await page.getByRole('combobox',{name:`Follow duration for ${team.name}`}).selectOption('7d');await page.getByRole('button',{name:'Follow Team',exact:true}).click();await page.getByRole('button',{name:'Unfollow',exact:true}).waitFor();
  prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')));assert.equal(prefs.following.items[0].duration,'7d');
  // Simulated live and final feed transitions. No production event or push sent.
  feed.games=feed.games.map(g=>g.id===game.id?{...g,status:'in',detail:'3rd Quarter',providerStatus:'STATUS_IN_PROGRESS',teams:g.teams.map((t,i)=>({...t,score:i?'14':'21'}))}:g);
  await page.goto(base+'/#watchlist');await page.locator('#watchlist').getByText('LIVE · 3rd Quarter',{exact:true}).waitFor();assert.match(await page.locator('#watchlist').innerText(),/21/);
  await page.goto(`${base}/team/${team.id}`);await page.getByRole('button',{name:'Unfollow',exact:true}).click();await page.getByRole('button',{name:'Follow Team',exact:true}).waitFor();await page.getByRole('combobox',{name:`Follow duration for ${team.name}`}).selectOption('game');await page.getByRole('button',{name:'Follow Team',exact:true}).click();await page.getByRole('button',{name:'Unfollow',exact:true}).waitFor();
  feed.games=feed.games.map(g=>g.id===game.id?{...g,status:'post',detail:'Final',completed:true,providerStatus:'STATUS_FINAL'}:g);
  await page.goto(base+'/#watchlist');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')).following.items.length===0);await page.locator('#watchlist').getByText('No active follows.',{exact:false}).waitFor();
  prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')));assert.equal(prefs.following.items.length,0);assert.equal(prefs.favorites.length,1);
  // Completed one-game follow must not reappear when its game leaves the feed.
  feed.games=feed.games.filter(g=>g.id!==game.id);await page.reload();await page.locator('#watchlist').getByText('No active follows.',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>window.__prompts),0);assert.equal(await page.getByRole('checkbox',{name:'Following alerts',exact:false}).isChecked(),false);
  for(const width of device?[390,320]:[1440,390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);}
  if(!device){await page.setViewportSize({width:1440,height:1000});console.log(engine.name()+': functional following flows passed; checking accessibility.');const axe=await new AxeBuilder({page}).include('#watchlist').include('#following').include('#alerts').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);}
  assert.deepEqual(errors,[]);console.log(`${engine.name()}: follow/unfollow, one-game/24h/7d, favorite isolation, persistence, watchlist scores/status/links, final cleanup, no permission prompt, mobile layout passed (simulated feed transitions).`);
  await context.close();
 }finally{await browser.close();}
}
