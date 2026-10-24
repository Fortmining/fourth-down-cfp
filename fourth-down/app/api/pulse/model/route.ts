import {NextResponse} from 'next/server';
import {redis,pushConfigured} from '../../../lib/push-store';
import {MODEL_LIMITATION} from '../../../lib/outlook-snapshots';
export const dynamic='force-dynamic';
export async function GET(){
 const data={notificationsSupported:false,limitation:MODEL_LIMITATION,snapshot:null as unknown,comparison:null as unknown};
 if(pushConfigured())try{const raw=await redis('GET','fd:v08:outlook');if(raw){const saved=JSON.parse(raw);if(Date.now()-saved.snapshot.generatedAt<=360000){data.snapshot=saved.snapshot;data.comparison=saved.comparison;}}}catch{}
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
}
