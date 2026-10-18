import { chromium, webkit, devices } from 'playwright';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.TEST_URL || 'http://127.0.0.1:3001';
const expectedApple=await readFile('public/apple-touch-icon.png');
for(const [engine,device] of [[webkit,'iPhone 13'],[chromium,'Pixel 7']]) {
 const browser=await engine.launch();
 try {
  const context=await browser.newContext({...devices[device],defaultBrowserType:undefined});
  const page=await context.newPage();
  const raw=await context.request.get(origin);assert.equal(raw.status(),200);
  const html=await raw.text();const head=html.slice(html.indexOf('<head>'),html.indexOf('</head>'));
  assert.equal((head.match(/rel="apple-touch-icon"/g)||[]).length,1,'One Apple icon must be in the initial server head');
  assert.equal((head.match(/rel="apple-touch-icon-precomposed"/g)||[]).length,0,'No competing Apple declaration');
  assert.match(head,/<link[^>]+rel="apple-touch-icon"[^>]+href="data:image\/png;base64,/);
  // Exercise browser decoding with all remote Apple icon downloads blocked.
  // This verifies the workaround removes that dependency; it is not a native
  // Safari Add to Home Screen test (that UI is outside Playwright).
  await page.route('**/*',route=>/apple-touch-icon.*\.png/.test(route.request().url()) ? route.abort() : route.continue());
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('.shell').waitFor();
  assert.equal(await page.locator('head > link[rel="apple-touch-icon"]').count(),1);
  assert.equal(await page.locator('body link[rel="apple-touch-icon"]').count(),0);
  const inline=await page.locator('head > link[rel="apple-touch-icon"]').getAttribute('href');
  assert.match(inline,/^data:image\/png;base64,/);
  const embedded=Buffer.from(inline.split(',')[1],'base64');assert.deepEqual(embedded,expectedApple);
  const size=await page.evaluate(async(src)=>{
   const image=new Image();image.src=src;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   // Gold panel is clearly visible at (60,60), independently from tab favicons.
   return {width:image.naturalWidth,height:image.naturalHeight,pixel:[...ctx.getImageData(60,60,1,1).data]};
  },inline);
  assert.deepEqual(size,{width:180,height:180,pixel:[229,168,0,255]});
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'),'Fourth Down');
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'),'yes');
  assert.equal(await page.locator('meta[name="mobile-web-app-capable"]').getAttribute('content'),'yes');
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#14243B');
  const manifestURL=await page.locator('link[rel="manifest"]').getAttribute('href');
  const response=await context.request.get(new URL(manifestURL,origin).href);assert.equal(response.status(),200);
  assert.match(response.headers()['content-type'],/manifest\+json/);
  const manifest=await response.json();assert.equal(manifest.name,'Fourth Down');
  const assets=await page.locator('head > link[rel="icon"]').evaluateAll(els=>els.map(el=>el.getAttribute('href')));
  const paths=new Set([...assets,...manifest.icons.map(i=>i.src),'/apple-touch-icon.png','/apple-touch-icon-precomposed.png']);
  for(const path of paths) {
   const assetURL=new URL(path,origin);
   const asset=await context.request.get(new URL(assetURL.pathname,origin).href);assert.equal(asset.status(),200,`${device}: ${path}`);
   assert.match(asset.headers()['content-type'],/image\//);
   const bytes=await asset.body();
   if(assetURL.pathname.endsWith('.png')) {
    const image=await sharp(bytes).metadata();assert.equal(image.width,image.height);
    if(assetURL.pathname.includes('apple-touch-icon')) {assert.equal(image.width,180);assert.equal(image.hasAlpha,false);}
   }
   assert.deepEqual(bytes,await readFile(`public${assetURL.pathname}`),`Deployed icon differs: ${assetURL.pathname}`);
  }
  console.log(`${engine.name()}/${device}: one inline Apple icon in server and hydrated head; exact yellow PNG decodes with remote Apple downloads blocked; ${paths.size} external favicon/manifest/fallback assets match.`);
  await context.close();
 } finally {await browser.close();}
}
