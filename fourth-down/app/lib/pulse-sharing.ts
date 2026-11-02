export const FOURTH_DOWN_CANONICAL_ORIGIN='https://fourth-down-cfp.vercel.app';
export function shareDescriptor(input:{path:string;title:string;publisher:string;description?:string;sample?:boolean},assetOrigin=FOURTH_DOWN_CANONICAL_ORIGIN){
 if(!/^\/pulse\/story\/[a-z0-9-]{1,60}\/[a-zA-Z0-9_-]{1,100}$/.test(input.path))throw Error('Invalid share identity');const origin=new URL(assetOrigin);if(origin.protocol!=='https:'||!origin.hostname.endsWith('.vercel.app')||origin.username||origin.password||origin.port)throw Error('Invalid asset origin');
 return {canonical:FOURTH_DOWN_CANONICAL_ORIGIN+input.path,image:origin.origin+input.path+'/share-image',title:(input.sample?'SAMPLE · ':'')+input.title,description:input.description||'Source: '+input.publisher+' · Discovered with Fourth Down Pulse.',width:1200,height:630};
}
