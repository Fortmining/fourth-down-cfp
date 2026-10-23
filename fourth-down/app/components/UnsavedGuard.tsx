"use client";
import {useEffect,useRef,useState} from 'react';
import AccessibleDialog from './AccessibleDialog';
export default function UnsavedGuard({dirty,save,discard,busy=false}:{dirty:boolean;save:()=>Promise<boolean>;discard:()=>void;busy?:boolean}){
 const [error,setError]=useState('');const [pending,setPending]=useState<null|(()=>void)>(null);const bypass=useRef(false);
 useEffect(()=>{
  if(!dirty){bypass.current=false;return;}
  const unload=(e:BeforeUnloadEvent)=>{if(!bypass.current){e.preventDefault();e.returnValue='';}};
  const click=(e:MouseEvent)=>{if(bypass.current||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const anchor=(e.target as Element).closest?.('a[href]') as HTMLAnchorElement|null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download')||anchor.closest('#alerts'))return;e.preventDefault();e.stopPropagation();setPending(()=>()=>{bypass.current=true;window.location.replace(anchor.href);});};
  // A duplicate current entry lets Back remain on this page until the draft is handled.
  const url=window.location.href;history.pushState({...history.state,notificationDraft:true},'',url);
  const back=(event:PopStateEvent)=>{if(event.state?.notificationDraft||document.querySelector('dialog[open]'))return;history.pushState({...history.state,notificationDraft:true},'',url);setPending(()=>()=>{bypass.current=true;history.go(-2);});};
  window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);window.addEventListener('popstate',back);
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);window.removeEventListener('popstate',back);if(!bypass.current&&history.state?.notificationDraft)history.back();};
 },[dirty]);
 if(!pending)return null;
 return <AccessibleDialog label="Unsaved notification changes" onClose={()=>{setError('');setPending(null);}}><h2>Save your changes?</h2><p>Your notification changes have not been saved.</p>{error&&<p role="alert">{error}</p>}<div className="dialogActions"><button disabled={busy} onClick={async()=>{if(await save()){const go=pending;setPending(null);go();}else setError('Save failed. Your changes are still here. Continue Editing to review the error and retry.');}}>Save</button><button disabled={busy} onClick={()=>{discard();const go=pending;setPending(null);go();}}>Discard</button><button disabled={busy} onClick={()=>{setError('');setPending(null);}}>Continue Editing</button></div></AccessibleDialog>;
}
