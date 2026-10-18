// Render the existing gold/navy 4TH brand as self-contained vectors, with the
// mark inside Android's central 80% safe zone. No font or network dependency.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/icons/fourth-down.svg', import.meta.url));
const target = new URL('../public/', import.meta.url);
for (const size of [16,32,48,152,167,180,192,512]) {
 await sharp(source).resize(size,size).removeAlpha().png().toFile(new URL(`icons/icon-${size}.png`,target).pathname);
}
await sharp(source).resize(512,512).removeAlpha().png().toFile(new URL('icons/icon-maskable-512.png',target).pathname);
await sharp(source).resize(180,180).removeAlpha().png().toFile(new URL('apple-touch-icon.png',target).pathname);
// ICO directory with 16/32/48px PNG frames (32-bit RGBA).
const frames=await Promise.all([16,32,48].map(size=>sharp(source).resize(size,size).ensureAlpha().png().toBuffer()));
const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=header.length;
frames.forEach((frame,i)=>{const entry=6+i*16;const size=[16,32,48][i];header[entry]=size;header[entry+1]=size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(frame.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=frame.length;});
await writeFile(new URL('favicon.ico',target),Buffer.concat([header,...frames]));
