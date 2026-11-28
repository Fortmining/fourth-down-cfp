import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function checkPlayoffs(page,{base,output='/tmp/fd-mobile-playoffs-check',mobile=true}={}){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/playoffs');await page.locator('.playoffTop12 li').nth(11).waitFor({timeout:45000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('.playoffTop12 li').count(),12);
 if(mobile){
  assert.equal(await page.locator('.mobileBracket').isVisible(),true);assert.equal(await page.locator('.bracketScroll').isVisible(),false);
  const tops=await page.evaluate(()=>({poll:document.querySelector('.playoffTop12').getBoundingClientRect().top,mode:document.querySelector('.playoffMode').getBoundingClientRect().top}));assert.ok(tops.poll<tops.mode);
  assert.equal(await page.locator('.mobileMatchup').count(),4);assert.equal(await page.locator('.mobileBracketTeam').count(),8);
  assert.ok(await page.locator('.mobileBracketTeam strong').first().isVisible());
  await page.getByRole('tab',{name:'Quarterfinals',exact:true}).click();assert.match(await page.locator('.mobileMatchup').first().innerText(),/Winner of 8 vs 9/);
  await page.getByRole('tab',{name:'Semifinals',exact:true}).click();assert.equal(await page.locator('.mobileMatchup').count(),2);
  await page.getByRole('tab',{name:'Championship',exact:true}).click();assert.equal(await page.locator('.mobileMatchup').count(),1);assert.match(await page.locator('.mobileMatchup').innerText(),/Winner of Semifinal 1/);
  await page.getByRole('button',{name:'Traditional bracket',exact:true}).click();assert.equal(await page.locator('.bracketScroll').isVisible(),true);assert.equal(await page.locator('.bracketNode').count(),11);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.getByRole('button',{name:'Close traditional bracket',exact:true}).click();
  await page.getByRole('button',{name:'What-If Simulator',exact:true}).click();
  // Every pick uses the existing matchup dialog and propagates through the same topology.
  for(const round of ['First Round','Quarterfinals','Semifinals','Championship']){
   await page.getByRole('tab',{name:round,exact:true}).click();const cards=page.locator('.mobileMatchup');
   for(let index=0;index<await cards.count();index++){
    await cards.nth(index).locator('.mobileBracketTeam').first().click();await page.getByRole('dialog',{name:'Playoff matchup'}).waitFor();const advances=page.getByRole('button',{name:/^Advance /});await (round==='Quarterfinals'?advances.last():advances.first()).click();await page.getByRole('button',{name:'Close matchup',exact:true}).click();
   }
  }
  assert.match(await page.locator('.mobileMatchup>p').innerText(),/champion pick/);
  await page.getByRole('tab',{name:'First Round',exact:true}).click();await page.locator('.mobileMatchup').nth(1).locator('.mobileBracketTeam').last().click();await page.getByRole('button',{name:/^Advance /}).click();await page.getByRole('button',{name:'Close matchup',exact:true}).click();
  await page.getByRole('tab',{name:'Championship',exact:true}).click();assert.equal(await page.locator('.mobileBracketTeam[aria-pressed=true]').count(),0);assert.match(await page.locator('.mobileMatchup').innerText(),/Winner of Semifinal 1/);
  await page.getByRole('button',{name:'Reset picks',exact:true}).click();await page.getByRole('tab',{name:'First Round',exact:true}).click();assert.equal(await page.locator('.mobileBracketTeam[aria-pressed=true]').count(),0);
  await page.getByRole('button',{name:'About projected seeds',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'About projected seeds'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'About projected seeds'}).evaluate(e=>e===document.activeElement),true);
  await page.getByRole('button',{name:'Projected',exact:true}).click();
 }else{assert.equal(await page.locator('.mobileBracket').isVisible(),false);assert.equal(await page.locator('.bracketScroll').isVisible(),true);assert.equal(await page.locator('.bracketNode').count(),11);}
 fs.mkdirSync(output,{recursive:true});await page.screenshot({path:output+'/'+(mobile?'mobile':'desktop')+'.png',fullPage:true});
 await page.getByRole('button',{name:'Official',exact:true}).click();assert.equal(await page.locator('.bracketNode').count(),0);assert.equal(await page.locator('.bracketTbd').count(),0);assert.match(await page.locator('.bracketEmpty').innerText(),/not been announced/);
 assert.deepEqual(errors,[]);return {base,mobile,top12:12,overflow:false,rounds:mobile?4:undefined,simulation:mobile?'11 picks, upstream invalidation and reset passed':undefined,officialPendingWithoutBoxes:true,pageErrors:errors};
}
