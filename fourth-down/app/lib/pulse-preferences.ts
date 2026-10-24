export const pulseTypes=['pulseUpset','pulseFinal','pulseClose','pulseInteresting','playoffShakeup','bubbleMovement'] as const;
export type PulseType=typeof pulseTypes[number];
export type PulsePreset='quiet'|'balanced'|'allIn';
export type PulseSelection=PulsePreset|'custom'|'choose';
export type PulsePreferences={enabled:boolean;/** Saved frequency profile; never use it as the visible selection. */preset:PulsePreset;gameSelectionMade?:true;categories:Record<PulseType,boolean>;rankings:{ap:boolean;coaches:boolean;cfp:boolean}};
export function defaultPulse():PulsePreferences{return {enabled:false,preset:'balanced',categories:{pulseUpset:false,pulseFinal:false,pulseClose:false,pulseInteresting:false,playoffShakeup:false,bubbleMovement:false},rankings:{ap:false,coaches:false,cfp:false}};}
export function normalizePulse(input:unknown):PulsePreferences{
 const p=input as Partial<PulsePreferences>|null,d=defaultPulse();d.enabled=p?.enabled===true;d.preset=['quiet','balanced','allIn'].includes(p?.preset||'')?p!.preset!:d.preset;
 for(const t of pulseTypes)d.categories[t]=!['playoffShakeup','bubbleMovement'].includes(t)&&p?.categories?.[t]===true;
 for(const t of ['ap','coaches','cfp'] as const)d.rankings[t]=p?.rankings?.[t]===true;
 if(p?.gameSelectionMade===true)d.gameSelectionMade=true;
 return d;
}
export const pulseGameTypes=['pulseFinal','pulseUpset','pulseClose','pulseInteresting'] as const;
const mappings:Record<PulsePreset,Record<typeof pulseGameTypes[number],boolean>>={
 quiet:{pulseFinal:true,pulseUpset:false,pulseClose:false,pulseInteresting:false},
 balanced:{pulseFinal:true,pulseUpset:true,pulseClose:true,pulseInteresting:false},
 allIn:{pulseFinal:true,pulseUpset:true,pulseClose:true,pulseInteresting:true}
};
export function pulseSelection(input:PulsePreferences):PulseSelection{
 const p=normalizePulse(input);
 for(const preset of ['quiet','balanced','allIn'] as const)if(pulseGameTypes.every(t=>p.categories[t]===mappings[preset][t]))return preset;
 return !p.gameSelectionMade&&pulseGameTypes.every(t=>!p.categories[t])?'choose':'custom';
}
// Only an explicit preset action applies defaults. Loading/normalizing never does.
export function pulsePreset(preset:PulsePreset,previous?:PulsePreferences):PulsePreferences{
 const p=normalizePulse(previous);return {...p,preset,enabled:true,gameSelectionMade:true,categories:{...p.categories,...mappings[preset]}};
}
export const pulseDailyLimit=(preset:PulsePreset)=>preset==='quiet'?3:preset==='allIn'?12:6;
export const pulseLabels:Record<PulseType,string>={pulseUpset:'Upset Watch',pulseFinal:'Confirmed Major Upset',pulseClose:'Close Game Discovery',pulseInteresting:'Interesting Live Game',playoffShakeup:'Playoff Shakeup',bubbleMovement:'Bubble Movement'};
