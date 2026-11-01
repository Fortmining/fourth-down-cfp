import directory from '../data/pulse-channels.json' with {type:'json'};
// Ownership verified from publisher links. Ownership is NOT activation or API permission.
export const pulseChannels=directory.channels.map(c=>({...c,verifiedAt:directory.verifiedAt,channelId:null as string|null,uploadsPlaylistId:null as string|null,enabled:false,apiPolicyApproved:false,teamIds:[] as string[],footballScope:false}));
export function channelReady(c:typeof pulseChannels[number]){return c.enabled&&c.apiPolicyApproved&&!!c.channelId&&/^UC[\w-]{22}$/.test(c.channelId)&&c.uploadsPlaylistId==='UU'+c.channelId.slice(2);}
