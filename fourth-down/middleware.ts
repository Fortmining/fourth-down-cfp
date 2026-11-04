import {NextResponse,type NextRequest} from 'next/server';
/** Canary Preview denies every application route except its replay and assets.
 * Ordinary production/development behavior is unchanged when no run is supplied. */
export function middleware(request:NextRequest){
 if(process.env.FOURTH_DOWN_CANARY_RUN){
 const p=request.nextUrl.pathname,allowed=p==='/canary/resumes'||p==='/api/canary/resumes'||p.startsWith('/_next/static/')||p==='/favicon.ico';
 if(process.env.VERCEL_ENV!=='preview'&&process.env.NODE_ENV!=='development'||!allowed||request.method!=='GET')return new NextResponse('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 }
 return NextResponse.next();
}
export const config={matcher:['/:path*']};
