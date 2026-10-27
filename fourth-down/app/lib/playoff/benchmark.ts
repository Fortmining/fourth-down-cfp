import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {benchmarkFixtureBase64,benchmarkFixtureSha256} from './benchmark-fixture.ts';
import {runShadow,candidates} from './engine.ts';
import {fanResume} from './fan-resume.ts';
import {retentionEnvelope} from './retention-envelope.ts';
import type {Inputs} from './types';

/** Bounded CPU/payload benchmark. No network, credentials, database or scheduler access. */
export function benchmarkResume(){
 const bytes=gunzipSync(Buffer.from(benchmarkFixtureBase64,'base64'));
 if(createHash('sha256').update(bytes).digest('hex')!==benchmarkFixtureSha256)throw Error('Benchmark fixture identity mismatch');
 const input=JSON.parse(bytes.toString()) as Inputs,runs=[];
 for(let i=0;i<10;i++){
  const start=performance.now(),cpu=process.cpuUsage();
  const confirmed=runShadow(input,candidates[0],false,null,'resume-shadow-v1.2.0');
  const provisional=runShadow(input,candidates[0],true,confirmed.id,confirmed.modelVersion);
  const display=fanResume(confirmed,i?confirmed:undefined,confirmed.at);
  const pair=retentionEnvelope(confirmed,provisional),compressed=gzipSync(JSON.stringify(display)),used=process.cpuUsage(cpu);
  runs.push({cpuMs:(used.user+used.system)/1000,wallMs:performance.now()-start,pairBytes:pair.bytes,compressedViewBytes:compressed.length});
 }
 const sorted=runs.map(r=>r.cpuMs).sort((a,b)=>a-b);
 return {schema:1,scope:'CPU/payload only; process CPU is not an invoice measurement',observedAt:new Date().toISOString(),fixtureAt:input.observedAt,fixtureSha256:benchmarkFixtureSha256,teams:input.teams.length,games:input.games.length,runs,medianCpuMs:sorted[5],maxCpuMs:sorted[9],totalCpuMs:runs.reduce((n,r)=>n+r.cpuMs,0),maxPairBytes:Math.max(...runs.map(r=>r.pairBytes)),maxCompressedViewBytes:Math.max(...runs.map(r=>r.compressedViewBytes)),additionalSourceRequests:0,databaseCommands:0,notificationCalls:0,newSchedules:0,hostedRedisWriteBillingMeasured:false};
}
