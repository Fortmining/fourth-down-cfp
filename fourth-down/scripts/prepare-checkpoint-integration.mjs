// OFFLINE ONLY. No credentials, network, deployment, QStash or push integration.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';import {randomBytes} from 'node:crypto';
import {IntegrationTestBudget,boundedIntegrationPort} from '../app/lib/playoff/integration-test-budget.ts';
import {integrationRedisSimulator} from '../tests/helpers/integration-redis-simulator.ts';
import {RedisResumeStore} from '../app/lib/playoff/redis-resume-store.ts';import {ResumePipeline} from '../app/lib/playoff/resume-pipeline.ts';import {hash} from '../app/lib/playoff/engine.ts';
const root=process.env.CHECKPOINT_PREPARATION_OUTPUT;if(!root)throw Error('New isolated output directory required');fs.mkdirSync(root,{recursive:true});
const runId=randomBytes(12).toString('hex'),budget=new IntegrationTestBudget(path.join(root,'budget'),runId,true),fake=integrationRedisSimulator(budget.namespace),gate=boundedIntegrationPort(budget,fake.port);
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../tests/fixtures/resume-real-replay.json.gz',import.meta.url))).toString());let now=Date.parse(fixture.before.observedAt);
const store=new RedisResumeStore(gate.port,budget.namespace,()=>now),noFetch={read:async()=>{throw Error('Unexpected source fetch');}},pipeline=new ResumePipeline(store,noFetch);
const capture=(inputs,controlled=false)=>({inputs,receivedAt:inputs.observedAt,sourceHashes:{fixture:hash(inputs)},notes:[controlled?'Invented score corrections for retention/failure testing; not real historical events':'Genuine archived capture; not a forecast accuracy test']});
const cpu=process.cpuUsage(),started=performance.now(),steps=[];let current,firstId;
try{
 for(const [n,input] of [[0,fixture.before],[1,fixture.after],...Array.from({length:32},(_,n)=>{const i=structuredClone(fixture.after);i.observedAt=new Date(Date.parse(i.observedAt)+(n+1)*120000).toISOString();const game=i.games.find(g=>g.completed&&g.state==='post');game.scores[game.teams.indexOf(game.winner)]+=n+1;game.observedAt=i.observedAt;return [n+2,i];})]){
  current=input;now=Date.parse(current.observedAt);if(n===10)fake.loseNextCommit(2);
  let result=await pipeline.ingest(capture(current,n>1),now);
  if(n===10){assert.equal(result.updated,false);budget.recovery('lost_ack_recovery');result=await pipeline.ingest(capture(current,true),now);}
  assert.ok(result.updated||result.status==='unchanged');const display=await pipeline.display(now);assert.equal(display.status,'ready');if(n===0)firstId=display.history[0].id;
  assert.equal(display.history.length,Math.min(n+1,32));steps.push({n,status:result.status,revision:display.revision,retained:display.history.length,at:current.observedAt,controlled:n>1});
 }
 const beforeFresh=budget.snapshot().total;
 for(let n=0;n<24;n++){now+=240000;current={...structuredClone(current),observedAt:new Date(now).toISOString()};const r=await pipeline.ingest(capture(current,true),now);assert.equal(r.compactFreshness,true);}
 const afterFresh=budget.snapshot().total,freshness={checks:24,reservedCommands:afterFresh.commands-beforeFresh.commands,reservedMutations:afterFresh.mutations-beforeFresh.mutations,reservedReads:afterFresh.reads-beforeFresh.reads,simulatedExpectedCommandsPerCheck:7};
 const workers=Array.from({length:4},()=>new ResumePipeline(new RedisResumeStore(gate.port,budget.namespace,()=>now),noFetch));let views=0;
 // 34 display checks above + 16 concurrent-worker checks = 50 total cache misses.
 for(let n=0;n<4;n++)await Promise.all(workers.map(async worker=>{const d=await worker.display(now);assert.equal(d.status,'ready');assert.equal(d.history.length,32);assert.ok(d.view.rows.every(row=>row.resumePosition!==null));views++;}));
 assert.equal((await pipeline.historyView(firstId,now)).status,'unavailable');
 const view=await pipeline.display(now),latest=view.history.at(-1);const historical=await pipeline.historyView(latest.id,now);assert.equal(historical.status,'archived');assert.equal(historical.comparisonContextRetained,true);
 const storageBytes=Array.from(fake.values.values()).reduce((sum,v)=>sum+Buffer.byteLength(v),0);
 const staleObserved=current.observedAt;now+=360001;const stale=await pipeline.display(now);assert.equal(stale.status,'withheld');assert.ok(stale.view.rows.every(row=>row.movement===null));
 // A later transport receipt cannot turn that stale observation into a new check.
 const delayed=capture(current,true);delayed.receivedAt=new Date(now).toISOString();assert.equal((await pipeline.ingest(delayed,now)).updated,false);
 const cleanup=await gate.cleanup();assert.equal(cleanup.complete,true);await new Promise(resolve=>setTimeout(resolve,1100));const absent=await gate.verifyExpired();assert.equal(absent.complete,true);
 const used=process.cpuUsage(cpu);const report={mode:'OFFLINE protocol simulation, not hosted Redis/Lua/Vercel measurement',runId,steps,freshness,views:34+views+2,retained:32,evictedReceiptRejected:true,staleObserved,staleDisplayWithheld:true,cleanup,absent,budget:budget.snapshot(),confirmedSimulatorCounters:fake.counters,measuredWrapper:gate.measured,logicalSimulatedStoredBytes:storageBytes,cpuMs:(used.user+used.system)/1000,wallMs:performance.now()-started,additionalSourceRequests:0,deployments:0,credentialsProvisioned:0,productionActivation:false};
 fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({mode:report.mode,retained:32,freshness,total:report.budget.total,logicalSimulatedStoredBytes:storageBytes,cpuMs:report.cpuMs,cleanup:cleanup.complete}));
}catch(error){await gate.cleanup().catch(()=>{});fs.writeFileSync(path.join(root,'failed-budget.json'),JSON.stringify(budget.snapshot(),null,2));throw error;}
