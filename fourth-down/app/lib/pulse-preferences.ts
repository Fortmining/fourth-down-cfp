export const pulseTypes=['pulseUpset','pulseFinal','pulseClose','pulseInteresting','playoffShakeup','bubbleMovement'] as const;
export type PulseType=typeof pulseTypes[number];
export type PulsePreset='quiet'|'balanced'|'allIn';
export type PulsePreferences={enabled:boolean;preset:PulsePreset;categories:Record<PulseType,boolean>;rankings:{ap:boolean;coaches:boolean;cfp:boolean}};
export function defaultPulse():PulsePreferences{return {enabled:false,preset:'balanced',categories:{pulseUpset:false,pulseFinal:false,pulseClose:false,pulseInteresting:false,playoffShakeup:false,bubbleMovement:false},rankings:{ap:false,coaches:false,cfp:false}};}
export function normalizePulse(input:unknown):PulsePreferences{
 const p=input as Partial<PulsePreferences>|null,d=defaultPulse();d.enabled=p?.enabled===true;d.preset=['quiet','balanced','allIn'].includes(p?.preset||'')?p!.preset!:d.preset;
 for(const t of pulseTypes)d.categories[t]=!['playoffShakeup','bubbleMovement'].includes(t)&&p?.categories?.[t]===true;
 for(const t of ['ap','coaches','cfp'] as const)d.rankings[t]=p?.rankings?.[t]===true;return d;
}
export function pulsePreset(preset:PulsePreset):PulsePreferences{
 const p=defaultPulse();p.preset=preset;p.enabled=true;p.categories.pulseFinal=true;p.categories.pulseClose=preset!=='quiet';p.categories.pulseUpset=preset==='allIn';p.categories.pulseInteresting=preset==='allIn';p.rankings={ap:true,coaches:true,cfp:true};return p;
}
export const pulseDailyLimit=(preset:PulsePreset)=>preset==='quiet'?3:preset==='allIn'?12:6;
export const pulseLabels:Record<PulseType,string>={pulseUpset:'Upset Watch',pulseFinal:'Confirmed Major Upset',pulseClose:'Close Game Discovery',pulseInteresting:'Interesting Live Game',playoffShakeup:'Playoff Shakeup',bubbleMovement:'Bubble Movement'};
