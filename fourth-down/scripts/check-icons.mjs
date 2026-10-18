import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const origin=process.env.TEST_URL || 'http://127.0.0.1:3001';
const browser=await chromium.launch();
try {
 for(const device of ['iPhone 13','Pixel 7']) {
  const context=await browser.newContext({...devices[device],defaultBrowserType:undefined});
  const page=await context.newPage();await page.goto(origin,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'),'Fourth Down');
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'),'yes');
  assert.equal(await page.locator('meta[name="mobile-web-app-capable"]').getAttribute('content'),'yes');
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#14243B');
  const manifestURL=await page.locator('link[rel="manifest"]').getAttribute('href');
  const response=await context.request.get(new URL(manifestURL,origin).href);assert.equal(response.status(),200);
  assert.match(response.headers()['content-type'],/manifest\+json/);
  const manifest=await response.json();assert.equal(manifest.name,'Fourth Down');
  const assets=await page.locator('link[rel="icon"],link[rel="apple-touch-icon"]').evaluateAll(els=>els.map(el=>el.getAttribute('href')));
  for(const path of new Set([...assets,...manifest.icons.map(i=>i.src),'/apple-touch-icon.png','/apple-touch-icon-precomposed.png'])) {
   const assetURL=new URL(path,origin);
   // Test local candidate bytes before publishing absolute production metadata.
   const asset=await context.request.get(new URL(assetURL.pathname,origin).href);assert.equal(asset.status(),200,`${device}: ${path}`);
   assert.match(asset.headers()['content-type'],/image\//);
   if(assetURL.pathname.endsWith('.png')) {
    const bytes=await asset.body();const image=await sharp(bytes).metadata();assert.equal(image.width,image.height);
    if(assetURL.pathname.includes('apple-touch-icon')) {assert.equal(image.width,180);assert.equal(image.hasAlpha,false);}
   }
   const local=await import('node:fs/promises').then(fs=>fs.readFile(`public${assetURL.pathname}`));
   assert.deepEqual(await asset.body(),local,`Production icon differs: ${assetURL.pathname}`);
  }
  console.log(`${device} browser emulation: Fourth Down title, Apple metadata, manifest, theme and all ${new Set([...assets,...manifest.icons.map(i=>i.src),'/apple-touch-icon.png','/apple-touch-icon-precomposed.png']).size} referenced icon assets verified.`);
  await context.close();
 }
} finally {await browser.close();}
