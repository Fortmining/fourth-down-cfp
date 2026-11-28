import assert from 'node:assert/strict';
import fs from 'node:fs';
/** Exercise the actual feed, with isolated preferences and no account writes. */
export async function checkPulse(page,{base,output='/tmp/fourth-down-pulse-check',publisher=true}={}){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('fourth-down-alert-preferences-v1'))localStorage.setItem('fourth-down-alert-preferences-v1',JSON.stringify({version:1,favorites:[{id:'130',name:'Michigan Wolverines'}]}));});
 await page.goto(base+'/pulse?feed=latest&team=&conference=&kind=all&view=all&older=0');await page.locator('.pulseNewsRow').first().waitFor({timeout:45000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('iframe').count(),0);
 const rowHeights=await page.locator('.pulseNewsRow').evaluateAll(es=>es.slice(0,10).map(e=>e.getBoundingClientRect().height));assert.ok(Math.max(...rowHeights)<165);
 const filters=[];
 for(const [label,key] of [['Latest','latest'],['Following','following'],['Recruiting','recruiting'],['Transfer Portal','portal']]){
  const button=page.getByRole('button',{name:label,exact:true});await button.click();await page.waitForFunction(label=>[...document.querySelectorAll('.pulseFeedTabs button')].some(e=>e.textContent===label&&e.getAttribute('aria-pressed')==='true'),label);assert.equal(await button.getAttribute('aria-pressed'),'true');
  if(key!=='latest'){await page.waitForFunction(key=>new URL(location.href).searchParams.get('feed')===key,key);assert.equal(new URL(page.url()).searchParams.get('feed'),key);}
  filters.push({filter:label,rows:await page.locator('.pulseNewsRow').count(),emptyState:await page.locator('.pulseFeedEmpty').count()>0});
 }
 await page.reload();await page.waitForFunction(()=>document.querySelector('.pulseFeedTabs button[aria-pressed=true]')?.textContent==='Transfer Portal');assert.equal(await page.getByRole('button',{name:'Transfer Portal',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Latest',exact:true}).click();await page.locator('.pulseNewsRow').first().waitFor();
 const more=page.getByRole('button',{name:'Load more stories',exact:true});if(await more.count())await more.click();
 const rows=await page.locator('.pulseNewsRow').count(),at=Math.min(16,rows-1),row=page.locator('.pulseNewsRow').nth(at);await row.scrollIntoViewIfNeeded();
 const position=await page.evaluate(()=>scrollY);await row.getByRole('button').click();await page.getByRole('dialog').waitFor();assert.equal(await page.locator('iframe').count(),0);assert.ok((await page.locator('.pulseReaderSummary').innerText()).length>20);
 await page.getByRole('button',{name:'Back to Pulse',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForTimeout(250);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-position)<3);
 const packet=await (await page.context().request.get(base+'/api/news-pulse')).json();
 const foxItem=packet.items.find(i=>i.sourceId==='fox-cfb'&&!['retracted','conflicted'].includes(i.state));assert.ok(foxItem,'FOX feed must be present');
 await page.goto(base+'/pulse/story/'+foxItem.sourceId+'/'+foxItem.id);await page.getByRole('link',{name:/Read Full Article/}).waitFor();assert.equal(await page.locator('iframe').count(),0);
 await page.getByRole('link',{name:'← Back to Pulse',exact:true}).click();await page.locator('.pulseNewsRow').nth(at).waitFor();await page.waitForFunction(y=>Math.abs(scrollY-y)<3,position);assert.equal(await page.locator('.pulseNewsRow').count(),rows);
 const fox=page.locator('.pulseNewsRow[data-source="fox-cfb"]').first();await fox.scrollIntoViewIfNeeded();await fox.getByRole('button').click();await page.getByRole('dialog').waitFor();
 assert.ok((await page.locator('.pulseReaderSummary').innerText()).length>20);let publisherResult=null;
 if(publisher){const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:/Read Full Article/}).click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');publisherResult={url:popup.url(),title:await popup.title()};assert.equal(new URL(popup.url()).hostname,'www.foxsports.com');assert.ok(publisherResult.title.length>5);await popup.close();}
 const dialogOverflow=await page.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(dialogOverflow,false);
 fs.mkdirSync(output,{recursive:true});await page.screenshot({path:output+'/preview.png'});await page.getByRole('button',{name:'Back to Pulse',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForTimeout(250);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:output+'/feed.png'});
 const otherPublishers=[];
 if(publisher)for(const source of ['espn-ncf','ncaa-fbs']){
  const row=page.locator('.pulseNewsRow[data-source="'+source+'"]').first();if(!await row.count())continue;
  await row.scrollIntoViewIfNeeded();await row.getByRole('button').click();await page.getByRole('dialog').waitFor();const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:/Read Full Article/}).click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');const result={source,url:popup.url(),title:await popup.title()};assert.ok(result.title.length>5);otherPublishers.push(result);await popup.close();await page.getByRole('button',{name:'Back to Pulse',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForTimeout(250);
 }
 assert.deepEqual(errors,[]);const result={base,engine:'iPhone-sized WebKit',filters,rows,rowHeights,previewWithoutFrames:true,scrollRestored:true,filterRestored:true,storyRouteWorks:true,publisher:publisherResult,otherPublishers,overflow:false,pageErrors:errors,sources:packet.freshness?.filter(f=>['espn-ncf','ncaa-fbs','ncaa-fcs','fox-cfb','cbs-cfb','nbc-cfb'].includes(f.sourceId)).map(f=>({source:f.sourceId,status:f.status,items:f.relevantItems})),newsPush:packet.pushDelivery};fs.writeFileSync(output+'/results.json',JSON.stringify(result,null,2));return result;
}
