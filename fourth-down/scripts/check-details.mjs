import {chromium,webkit,devices} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:3001';
const feed=await(await fetch(base+'/api/live')).json();
const game=feed.games.find(g=>g.status==='pre'&&!g.kickoffTbd);
assert.ok(game,'Real upcoming game required for detail checks');
const team=game.teams[0];
for(const [engine,device] of [[chromium,null],[webkit,'iPhone 13']]){
 const browser=await engine.launch();
 try{
  const context=await browser.newContext(device?{...devices[device],reducedMotion:'reduce'}:{viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/live',r=>r.fulfill({json:feed}));
  await page.goto(base);await page.locator('.scoreGrid .game').first().waitFor();assert.ok((await page.locator('.scoreGrid .game a').first().getAttribute('href')).startsWith('/game/'));await page.locator('.tier .team summary').first().click();assert.ok((await page.getByRole('link',{name:'Team schedule & results',exact:false}).first().getAttribute('href')).startsWith('/team/'));
  await page.goto(`${base}/game/${game.id}`);await page.getByRole('heading',{name:game.name,exact:true,level:1}).waitFor();
  assert.match(await page.locator('.detailCard').first().innerText(),/AM|PM|GMT|UTC/);
  assert.ok(await page.locator(`a[href="/team/${team.id}"]`).isVisible());
  await page.locator(`a[href="/team/${team.id}"]`).click();await page.getByRole('heading',{name:team.name,exact:true,level:1}).waitFor();
  await page.getByRole('button',{name:'Add favorite',exact:true}).click();
  await page.getByText('Favorite saved on this device. Save alert settings to apply this change to notification delivery.',{exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Remove favorite',exact:true}).waitFor();
  await page.getByRole('link',{name:'Manage notification settings',exact:true}).click();
  await page.locator('.favoriteChips button').filter({hasText:team.name}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'My Teams alerts',exact:false}).isChecked(),false,'Favorite never implicitly opts into notifications');
  await page.goto(`${base}/team/${team.id}`);await page.getByRole('button',{name:'Remove favorite',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'Add favorite',exact:true}).waitFor();
  assert.ok(await page.getByText('Current scoreboard and the next two ESPN schedule periods.',{exact:false}).isVisible());
  if(!device)for(const appearance of ['light','dark']){
   await page.evaluate(a=>localStorage.setItem('fourth-down-appearance',a),appearance);
   for(const path of [`/team/${team.id}`,`/game/${game.id}`]){
    await page.goto(base+path);await page.locator('.detailCard').first().waitFor();
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${appearance} ${path}`);
   }
  }
  if(device)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const tbd=feed.games.find(g=>g.status==='pre'&&g.kickoffTbd);if(tbd){await page.goto(`${base}/game/${tbd.id}`);await page.locator('.detailCard').first().waitFor();const date=await page.evaluate(value=>new Date(value).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}),tbd.date);assert.match(await page.locator('.detailCard').first().innerText(),/Kickoff time TBD/);assert.ok((await page.locator('.detailCard').first().innerText()).includes(date),'TBD kickoff still shows its date');}
  await page.goto(base+'/game/not-an-id');await page.locator('.empty').filter({hasText:'This link has an invalid identifier.'}).waitFor();
  await page.goto(base+'/game/999999999999');await page.getByText('This item is not in the current live feed.',{exact:false}).waitFor();
  await page.unroute('**/api/live');await page.route('**/api/live',r=>r.fulfill({status:503,json:{error:'Unavailable'}}));
  await page.goto(`${base}/team/${team.id}`);await page.getByText('Could not refresh live data. Any previous snapshot remains visible.',{exact:true}).waitFor();
  await page.unroute('**/api/live');await page.route('**/api/live',r=>r.fulfill({json:feed}));
  await page.getByRole('button',{name:'Refresh details',exact:true}).click();await page.getByRole('heading',{name:team.name,exact:true,level:1}).waitFor();
  assert.deepEqual(errors,[]);console.log(engine.name()+': game/team routes, favorite persistence/no implicit opt-in, unavailable and error recovery states, contrast and mobile layout passed.');
  await context.close();
 }finally{await browser.close();}
}
