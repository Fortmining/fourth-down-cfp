import {NextResponse} from 'next/server';
import {newsPacket} from '../../lib/news-pulse-service';
export async function GET(){const packet=await newsPacket();return NextResponse.json(packet,{headers:{'Cache-Control':packet.mode==='fixtures'?'no-store':'private, max-age=60'}});}
