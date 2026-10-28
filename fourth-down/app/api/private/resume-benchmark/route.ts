import {benchmarkResume} from '../../../lib/playoff/benchmark.ts';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(){
 // Never expose this measurement endpoint in production or local app usage.
 // Preview access additionally inherits the existing Vercel deployment protection.
 if(process.env.VERCEL_ENV!=='preview')return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 return Response.json({...benchmarkResume(),environment:'preview',region:process.env.VERCEL_REGION??'unknown',node:process.version,commit:process.env.VERCEL_GIT_COMMIT_SHA??null},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request){
 // Enabling this non-secret flag requires a separately approved Preview deployment.
 if(process.env.VERCEL_ENV!=='preview'||process.env.FOURTH_DOWN_ENABLE_RESOURCE_BENCHMARK!=='true')return new Response('Not found',{status:404});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origin rejected'},{status:403});
 try{
  const raw=await request.text();if(raw.length>4096)return Response.json({error:'Benchmark receipt too large'},{status:400});
  const data=JSON.parse(raw);if(data.confirmIsolatedBenchmark!==true)return Response.json({error:'Explicit benchmark confirmation required'},{status:400});
  const {runResourceBenchmark,hostedBenchmarkRedis,validateBenchmarkBudget}=await import('../../../lib/playoff/resource-benchmark.ts');
  validateBenchmarkBudget(data.budget);
  const transport=hostedBenchmarkRedis();
  const result=await runResourceBenchmark(transport.command,data.budget,process.env.VERCEL_DEPLOYMENT_ID||'preview-deployment');
  return Response.json({...result,wire:transport.wire,environment:'preview',transport:'Upstash REST',measurementScope:'Redis/cache workload; not the public website visitor path'},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Benchmark incomplete or unavailable; do not treat this as a pass. Expiry is attempted for isolated test keys; inspect the test namespace if storage was unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
