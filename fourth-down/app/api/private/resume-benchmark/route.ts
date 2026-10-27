import {benchmarkResume} from '../../../lib/playoff/benchmark.ts';
export const dynamic='force-dynamic';
export const maxDuration=30;
export async function GET(){
 // Never expose this measurement endpoint in production or local app usage.
 // Preview access additionally inherits the existing Vercel deployment protection.
 if(process.env.VERCEL_ENV!=='preview')return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 return Response.json({...benchmarkResume(),environment:'preview',region:process.env.VERCEL_REGION??'unknown',node:process.version,commit:process.env.VERCEL_GIT_COMMIT_SHA??null},{headers:{'Cache-Control':'no-store'}});
}
