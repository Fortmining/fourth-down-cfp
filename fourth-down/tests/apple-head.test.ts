import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { appleTouchIcon } from '../app/lib/apple-touch-icon.ts';
test('inline Apple icon decodes to the exact opaque yellow/navy source PNG',async()=>{
 assert.match(appleTouchIcon,/^data:image\/png;base64,/);
 const bytes=Buffer.from(appleTouchIcon.split(',')[1],'base64');
 assert.deepEqual(bytes,readFileSync('public/apple-touch-icon.png'));
 const info=await sharp(bytes).metadata();
 assert.equal(info.width,180);assert.equal(info.height,180);assert.equal(info.hasAlpha,false);
 const { data, info:raw }=await sharp(bytes).raw().toBuffer({resolveWithObject:true});
 let gold=0,navy=0;
 for(let i=0;i<data.length;i+=raw.channels){
  if(data[i]===229 && data[i+1]===168 && data[i+2]===0)gold++;
  if(data[i]===20 && data[i+1]===36 && data[i+2]===59)navy++;
 }
 assert.ok(gold>3000,'Must contain the yellow logo, not only a navy monogram tile');
 assert.ok(navy>10000,'Must retain stadium navy background and digit');
});
