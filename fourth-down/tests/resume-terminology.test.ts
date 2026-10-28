import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';
import {runShadow,candidates} from '../app/lib/playoff/engine.ts';import {fanResume} from '../app/lib/playoff/fan-resume.ts';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/resume-real-replay.json.gz',import.meta.url))).toString());
const before=runShadow(fixture.before,candidates[0],false,null,'resume-shadow-v1.2.0'),after=runShadow(fixture.after,candidates[0],false,null,'resume-shadow-v1.2.0');
test('display terminology is ASCII Resume while historic model identities stay frozen',()=>{
 assert.equal(before.id,'9b06086d5c7e159e7cb9a533e64ee23a801b593f0251e67944ce28086786cc31');assert.equal(after.id,'248f99170de47d8e470803b0a9bf7f37109fa5f6cc3a1db5dd393fdb347121a6');
 assert.doesNotMatch(JSON.stringify(fanResume(after,before,'2026-10-27T12:00:00Z')),/r\u00e9sum\u00e9/i);
});
test('user-facing source, metadata and documentation consistently use Resume',()=>{
 const root=path.resolve(import.meta.dirname,'..');
 const frozen=path.join(root,'app/lib/playoff/engine.ts');
 for(const folder of ['app','docs','scripts'])for(const entry of fs.readdirSync(path.join(root,folder),{recursive:true,withFileTypes:true})){if(!entry.isFile())continue;const file=path.join(entry.parentPath,entry.name);if(file===frozen||!/\.(?:tsx?|m?js|css|md|py)$/.test(file))continue;assert.doesNotMatch(fs.readFileSync(file,'utf8'),/r\u00e9sum\u00e9/i,file);}
 // The frozen engine label is an internal hashed historical value, never a display label.
});
