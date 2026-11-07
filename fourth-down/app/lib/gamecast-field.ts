import type {PlayAnimation} from './game-center.ts';
export const GOAL_CROSSBAR_Y=20;
export const GOAL_TARGET_Y=15;
export const fieldX=(yards:number,teamId:string|null|undefined,referenceTeamId:string|null)=>teamId&&referenceTeamId&&teamId!==referenceTeamId?10+yards:110-yards;
export function fieldMotionPath(motion:Pick<PlayAnimation,'from'|'to'|'teamId'|'kind'>,referenceTeamId:string|null){
 const from=fieldX(motion.from,motion.teamId,referenceTeamId),to=fieldX(motion.to,motion.teamId,referenceTeamId);
 const aerial=motion.kind!=='rush'&&motion.kind!=='ground',goal=motion.kind==='field-goal'||motion.kind==='extra-point';
 const endY=goal?GOAL_TARGET_Y:27;
 return `M ${from} 27 ${aerial?`Q ${(from+to)/2} 4 ${to} ${endY}`:`L ${to} 27`}`;
}
