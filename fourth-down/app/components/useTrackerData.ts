"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Feed} from '../lib/tracker-types';import type {SharedResumeDisplay} from '../lib/playoff/resume-pipeline';
export function useLiveFeed(){
 const [data,setData]=useState<Feed|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);const active=useRef<AbortController|null>(null);
 const refresh=useCallback(async()=>{if(active.current||document.querySelector('dialog[open],[role=dialog]'))return;const control=new AbortController();active.current=control;setBusy(true);try{const r=await fetch('/api/live',{cache:'no-store',signal:AbortSignal.any([control.signal,AbortSignal.timeout(15000)])});if(!r.ok)throw Error();const next:Feed=await r.json();if(!Array.isArray(next.games)||!Array.isArray(next.polls)||!Array.isArray(next.rankings)||!next.updatedAt)throw Error();if(!control.signal.aborted){setData(next);setError('');}}catch{if(!control.signal.aborted)setError('The latest scores could not be loaded. Try again shortly.');}finally{if(active.current===control){active.current=null;setBusy(false);}}},[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},60000);return()=>{clearInterval(timer);active.current?.abort();active.current=null;};},[refresh]);return {data,error,busy,refresh};
}
export function useResumePacket(){
 const [packet,setPacket]=useState<SharedResumeDisplay|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const abort=new AbortController();let running=false;const read=async()=>{if(running||document.hidden||document.querySelector('dialog[open],[role=dialog]'))return;running=true;try{const r=await fetch('/api/resumes',{cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});if(!r.ok)throw Error();const next=await r.json();if(next.view?.season!==2026)throw Error();if(!abort.signal.aborted){setPacket(next);setError(false);}}catch{if(!abort.signal.aborted)setError(true);}finally{running=false;}};void read();const timer=setInterval(()=>void read(),60000);return()=>{abort.abort();clearInterval(timer);};},[]);return {packet,error};
}
