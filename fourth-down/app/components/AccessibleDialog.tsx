"use client";
import {useEffect,useRef,type ReactNode} from 'react';
export default function AccessibleDialog({label,onClose,children}:{label:string;onClose:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),close=useRef(onClose);useEffect(()=>{close.current=onClose;});
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const element=dialog.current!;element.showModal();return()=>{element.close();previous?.focus();};},[]);
 useEffect(()=>{const element=dialog.current;if(element?.open&&!element.contains(document.activeElement))element.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')?.focus();});
 return <dialog ref={dialog} className="followDialog" aria-label={label} onKeyDown={e=>{if(e.key!=='Tab')return;const elements=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);if(!elements.length){e.preventDefault();return;}const index=elements.indexOf(document.activeElement as HTMLElement);e.preventDefault();elements[(index+(e.shiftKey?-1:1)+elements.length)%elements.length].focus();}} onCancel={e=>{e.preventDefault();close.current();}}>{children}</dialog>;
}
