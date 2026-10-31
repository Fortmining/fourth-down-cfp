import {NextResponse} from 'next/server';
import {newsSources,type NewsPacket} from '../../lib/news-pulse';
export async function GET(){
  // Fixture mode is local development only, never Vercel or production builds.
  const fixture=process.env.NODE_ENV==='development'&&!process.env.VERCEL&&process.env.FOURTH_DOWN_NEWS_PILOT==='fixtures';
  const packet:NewsPacket=fixture?(await import('../../lib/news-pulse-fixtures')).newsFixturePacket():{version:1,mode:'unavailable',evaluatedAt:new Date().toISOString(),items:[],sources:newsSources,pushDelivery:false};
  return NextResponse.json(packet,{headers:{'Cache-Control':fixture?'no-store':'public, max-age=60'}});
}
