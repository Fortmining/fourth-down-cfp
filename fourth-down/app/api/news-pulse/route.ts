import {NextResponse} from 'next/server';
import {newsSources,type NewsPacket} from '../../lib/news-pulse';
import {newsFixturesEnabled} from '../../lib/news-review-mode';
export async function GET(){
  // Local fixtures or explicitly approved isolated Preview; never production.
  const fixture=newsFixturesEnabled();
  const packet:NewsPacket=fixture?(await import('../../lib/news-pulse-fixtures')).newsFixturePacket():{version:1,mode:'unavailable',evaluatedAt:new Date().toISOString(),items:[],sources:newsSources,pushDelivery:false};
  return NextResponse.json(packet,{headers:{'Cache-Control':fixture?'no-store':'public, max-age=60'}});
}
