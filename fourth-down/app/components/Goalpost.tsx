"use client";
import {useEffect,useState,type RefObject} from 'react';
type Point={x:number;y:number};
type Goal={end:'left'|'right';anchor:Point;scale:number;heightScale:number};
type Layout={width:number;height:number;goals:Goal[]};
// Rotate the existing assembly around its vertical (height) axis. Camera depth
// foreshortens the crossbar; upright members remain vertical in the image.
const halfWidth=18.5/6,crossbarHeight=10/3,uprightHeight=10;
export default function Goalpost({anchor,scale,heightScale,end}:Goal){
 const facing=end==='left'?-85:85;
 const yaw=facing*Math.PI/180;
 const project=(across:number,height:number)=>{
  const depth=across*Math.sin(yaw),perspective=80/(80+depth);
  return {x:anchor.x+across*Math.cos(yaw)*scale*perspective,
   y:anchor.y+(depth*.35*scale-height*heightScale)*perspective};
 };
 const a=project(-halfWidth,crossbarHeight),b=project(halfWidth,crossbarHeight);
 const topA=project(-halfWidth,uprightHeight),topB=project(halfWidth,uprightHeight);
 const joint=project(0,crossbarHeight);
 const thickness=Math.max(2,.5*scale);
 return <g className="gcGoalpost" data-end={end} data-facing-angle={facing} aria-hidden="true">
  <ellipse cx={anchor.x} cy={anchor.y} rx={scale*.7} ry={scale*.15} fill="#071b14" opacity=".7"/>
  <g fill="none" stroke="#ffdb4b" strokeWidth={thickness} strokeLinecap="round" strokeLinejoin="round">
   <line className="gcGoalpostSupport" x1={joint.x} y1={joint.y} x2={anchor.x} y2={anchor.y} strokeWidth={thickness}/>
   <line className="gcGoalpostCrossbar" x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>
   <line className="gcGoalpostUpright" x1={a.x} y1={a.y} x2={topA.x} y2={topA.y}/>
   <line className="gcGoalpostUpright" x1={b.x} y1={b.y} x2={topB.x} y2={topB.y}/>
  </g>
 </g>;
}
export function GoalpostsLayer({field}:{field:RefObject<HTMLDivElement|null>}){
 const [layout,setLayout]=useState<Layout|null>(null);
 useEffect(()=>{
  const host=field.current;if(!host)return;
  const update=()=>{
   const box=host.getBoundingClientRect();
   const locate=(selector:string)=>{const rect=host.querySelector(selector)?.getBoundingClientRect();return rect?{x:rect.left+rect.width/2-box.left,y:rect.top+rect.height/2-box.top}:null;};
   const left=locate('[data-goal-anchor="left"]'),right=locate('[data-goal-anchor="right"]');
   const leftAir=locate('[data-goal-air="left"]'),rightAir=locate('[data-goal-air="right"]');
   if(!left||!right||!leftAir||!rightAir||!box.width)return;
   const scale=(right.x-left.x)/120;
   const next={width:box.width,height:box.height,goals:[{end:'left' as const,anchor:left,scale,heightScale:(left.y-leftAir.y)/(20/3)},{end:'right' as const,anchor:right,scale,heightScale:(right.y-rightAir.y)/(20/3)}]};
   setLayout(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
  };
  const observer=new ResizeObserver(update);observer.observe(host);const svg=host.querySelector('.gcFieldPlane > svg');if(svg)observer.observe(svg);update();
  return()=>observer.disconnect();
 },[field]);
 return layout?<svg className="gcGoalpostsLayer" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
  {layout.goals.map(goal=><Goalpost key={goal.end} {...goal}/>)}</svg>:null;
}
