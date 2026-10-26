import {chromium,firefox,webkit,devices} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const url=process.env.TEST_URL||'http://127.0.0.1:3011',at=new Date().toISOString(),now=Date.now();
const team={id:'2633',name:'Tennessee Volunteers'},other={id:'2579',name:'South Carolina Gamecocks'};
const game=(id,status,days=0)=>({id,name:'Tennessee vs South Carolina',date:new Date(now+days*86400000).toISOString(),status,providerStatus:status==='post'?'STATUS_FINAL':status==='in'?'STATUS_IN_PROGRESS':'STATUS_SCHEDULED',completed:status==='post',detail:status==='post'?'Final':status==='in'?'4th Quarter':'Scheduled',period:status==='in'?4:null,clock:status==='in'?240:null,kickoffTbd:status==='pre',neutralSite:true,venue:'Stadium',conferenceGame:true,broadcast:'ABC',teams:[{...team,score:status==='pre'?undefined:'24',homeAway:'away'},{...other,score:status==='pre'?undefined:'27',homeAway:'home'}]});
const ranked={teamId:team.id,name:team.name,rank:11,previous:9,record:'6-1',conference:'SEC',logo:'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png'};
const poll={id:'ap',name:'AP Top 25',url:'https://apnews.com',status:'available',date:'2026-10-18T07:00Z',season:2026,week:8,teams:[ranked]};
const games=[game('100','in'),game('200','post',-1),...Array.from({length:10},(_,i)=>game(String(300+i),'pre',i+1))];
const detail={...team,nickname:'Volunteers',mascot:'Smokey',logo:ranked.logo,conference:'SEC',standing:'6th in SEC',record:{overall:'6-2',conference:'3-2',status:'available',source:'ESPN verified game ledger',observedAt:at},season:2026,games,scheduleAvailable:true,polls:[poll],stats:[{id:'yards',label:'Total offense yards / game',value:'394.5',espnRank:'65th',basis:'ESPN 2026 regular season'},{id:'allowedYards',label:'Yards allowed / game',value:null,espnRank:null,basis:'ESPN 2026 regular season'}],warnings:[],observedAt:at,sources:[]};
const feed={games:[games[0]],polls:[poll],rankings:[ranked],season:2026,week:9,updatedAt:at,warnings:[],rankingSource:poll.name,rankingDate:poll.date,defaultRankingSource:'ap',currentRecords:{2633:detail.record}};
const prefs={version:1,favorites:[{id:'194',name:'Ohio State Buckeyes'}],myTeams:{enabled:true,kickoff:true,final:true},breaking:{enabled:true,ap:true},following:{enabled:false,items:[]}};
for(const [engine,mobile] of [[chromium,false],[firefox,false],[webkit,false],[webkit,true]]){
 if(process.env.TEAM_ENGINE&&engine.name()!==process.env.TEAM_ENGINE)continue;
 if(process.env.TEAM_MOBILE==='1'&&!mobile)continue;
 const browser=await engine.launch();const c=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1280,height:900}});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await c.addInitScript(p=>{if(!localStorage.getItem('fourth-down-alert-preferences-v1'))localStorage.setItem('fourth-down-alert-preferences-v1',JSON.stringify(p));},prefs);
 let current=structuredClone(detail),failed=false,requests=0;
 await p.route('**/api/teams/2633',r=>{requests++;return r.fulfill(failed?{status:503,json:{error:'offline'}}:{json:current});});
 await p.route('**/api/live',r=>r.fulfill({json:feed}));
 await p.route('**/api/pulse/model',r=>r.fulfill({json:{notificationsSupported:false,snapshot:null}}));
 await p.route('**/api/games/200',r=>r.fulfill({json:{game:games[1],observedAt:at}}));
 await p.goto(url+'/team/2633');await p.getByRole('heading',{name:team.name,exact:true,level:1}).waitFor();
 assert.match(await p.locator('#overview').innerText(),/Mascot: Smokey/);assert.match(await p.locator('#overview').innerText(),/6-2/);assert.match(await p.locator('#overview').innerText(),/3-2/);assert.match(await p.locator('#overview').innerText(),/No. 11/);
 assert.equal(await p.locator('.teamScheduleCard').count(),12);assert.match(await p.locator('[aria-label="Next game"]').innerText(),/LIVE NOW/);assert.match(await p.locator('#schedule').innerText(),/L · 24 – 27/);assert.match(await p.locator('#schedule').innerText(),/Neutral site/);assert.match(await p.locator('#schedule').innerText(),/Kickoff time TBD/);assert.match(await p.locator('#stats').innerText(),/394.5/);assert.match(await p.locator('#stats').innerText(),/Unavailable/);
 await p.getByRole('button',{name:'Follow Team',exact:true}).click();let dialog=p.getByRole('dialog');await dialog.getByLabel('Follow duration').selectOption('7d');assert.equal(await dialog.getByLabel('Scoring updates',{exact:true}).isChecked(),false);await dialog.getByRole('button',{name:'Confirm & Follow',exact:true}).click();await dialog.waitFor({state:'hidden'});
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1')));assert.deepEqual(saved.favorites,prefs.favorites);assert.equal(saved.following.items[0].id,'2633');assert.equal(saved.following.items[0].duration,'7d');
 await p.reload();await p.getByRole('button',{name:'Manage Follow',exact:true}).waitFor();
 current={...detail,games:[{...games[0],status:'post',providerStatus:'STATUS_FINAL',completed:true,detail:'Final'},...games.slice(1)]};await p.getByRole('button',{name:'Refresh team',exact:true}).click();await p.locator('[aria-label="Next game"]').getByText('NEXT GAME',{exact:true}).waitFor();
 current={...current,mascot:'No official mascot'};await p.getByRole('button',{name:'Refresh team',exact:true}).click();await p.getByText('Mascot: No official mascot',{exact:true}).waitFor();
 current={...current,mascot:'Not available'};await p.getByRole('button',{name:'Refresh team',exact:true}).click();await p.getByText('Mascot: Not available',{exact:true}).waitFor();
 failed=true;await p.getByRole('button',{name:'Refresh team',exact:true}).click();await p.locator('.teamWarning[role=alert]').waitFor();assert.match(await p.locator('#overview').innerText(),/6-2/);failed=false;
 for(const appearance of ['dark','light']){await p.getByLabel('Appearance',{exact:true}).selectOption(appearance);for(const color of ['stadium','turf','prime']){await p.getByLabel('Colorway',{exact:true}).selectOption(color);const a=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa']).analyze();assert.deepEqual(a.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],`${engine.name()} ${appearance}/${color}`);}}
 if(mobile)for(const width of [320,390,430,844]){await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 console.log(`${engine.name()} ${mobile?'mobile':'desktop'}: team controls, persistence, live/failure states and six theme accessibility checks passed`);
 await p.setViewportSize({width:mobile?390:1280,height:900});await p.screenshot({path:`/tmp/fourth-down-team-${engine.name()}-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await p.locator('a[href="/game/200"]').click();await p.getByRole('heading',{name:games[1].name,level:1,exact:true}).waitFor({timeout:45000}).catch(async e=>{console.log('Old-game failure',p.url(),await p.locator('body').innerText());throw e;});assert.match(await p.locator('.detailCard').innerText(),/27/);await p.goBack();await p.getByRole('heading',{name:team.name,level:1,exact:true}).waitFor();
 await p.goto(url+'/');await p.locator('.publishedList').getByRole('link',{name:team.name,exact:true}).waitFor();
 for(const selector of ['.publishedList','.outlook','.comparison','.movers','.scoreGrid','.bracket']){
  if(selector==='.outlook')await p.getByRole('button',{name:'Playoff outlook',exact:true}).click();
  if(selector==='.comparison')await p.getByRole('button',{name:'Compare polls',exact:true}).click();
  if(selector==='.bracket')await p.getByRole('button',{name:/^12-team bracket/}).click();
  assert.ok(await p.locator(selector+' a[href="/team/2633"]').count()>0,selector+' links');
 }
 // Timed team follow saved earlier appears in Watchlist; team link opens the dedicated page.
 await p.locator('#watchlist a[href="/team/2633"]').first().click();await p.getByRole('heading',{name:team.name,exact:true,level:1}).waitFor();
 await p.screenshot({path:`/tmp/fourth-down-team-${engine.name()}-${mobile?'mobile':'desktop'}-overview.png`});
 assert.deepEqual(errors,[]);assert.ok(requests>=4);console.log(`${engine.name()} ${mobile?'iPhone-sized':'desktop'}: full schedule, W/L, live transition, old-game fallback, stats/missing values, all navigation entry links, back, timed follow persistence/favorite isolation, failed refresh, themes and accessibility passed (simulated feeds)`);await browser.close();
}
