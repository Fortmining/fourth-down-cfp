import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
test('Home Screen manifest has the brand name, scoped standalone launch and valid icon sizes', async()=>{
 assert.equal(manifest.name,'Fourth Down'); assert.equal(manifest.short_name,'Fourth Down');
 assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.id,'/');
 assert.equal(manifest.display,'standalone');assert.equal(manifest.theme_color,'#14243B');
 assert.ok(manifest.icons.some(i=>i.purpose==='maskable'&&i.sizes==='512x512'));
 for(const icon of manifest.icons){const info=await sharp(`public${icon.src}`).metadata();assert.equal(`${info.width}x${info.height}`,icon.sizes);assert.equal(info.format,'png');assert.equal(info.hasAlpha,false);}
});
test('Apple touch icons and favicon contain real, correctly sized branded assets',async()=>{
 for(const [file,size] of [['apple-touch-icon.png',180],['icons/icon-152.png',152],['icons/icon-167.png',167],['icons/apple-touch-icon-v04-180.png',180],['apple-touch-icon-precomposed.png',180]]) {
  const info=await sharp(`public/${file}`).metadata();assert.equal(info.width,size);assert.equal(info.height,size);
 }
 const ico=readFileSync('public/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
 for(let i=0;i<3;i++){const offset=6+i*16;const size=[16,32,48][i];assert.equal(ico[offset],size);const start=ico.readUInt32LE(offset+12);const end=start+ico.readUInt32LE(offset+8);const info=await sharp(ico.subarray(start,end)).metadata();assert.equal(info.width,size);assert.equal(info.height,size);}
});
