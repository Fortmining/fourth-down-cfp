"use client";
import {useEffect,useState} from 'react';
import {MODEL_LIMITATION,type OutlookSnapshot} from '../lib/outlook-snapshots';
type Status={snapshot:OutlookSnapshot|null;comparison:{changes:{id:string;name:string;from:number;to:number;reason:string}[]}|null};
export default function ModelStatus(){
 const [status,setStatus]=useState<Status|null>(null),[change,setChange]=useState('');
 useEffect(()=>{setChange(new URLSearchParams(location.search).get('modelChange')||'');fetch('/api/pulse/model',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(setStatus).catch(()=>setStatus({snapshot:null,comparison:null}));},[]);
 const valid=change&&status?.snapshot?.id===change;
 return <aside className={`modelStatus ${valid?'highlightChange':''}`} aria-label="Playoff intelligence status"><h3>Playoff outlook status</h3><p>{MODEL_LIMITATION}</p>{status?.snapshot?<><p>Validated AP outlook snapshot: {status.snapshot.edition.slice(0,10)}. Confirmed across two independent checks.</p>{status.comparison?.changes.map(t=><p key={t.id}><a href={`/team/${t.id}`}>{t.name}</a>: {t.reason}</p>)}</>:<p>No fresh, complete, independently confirmed outlook snapshot is available. Incomplete or stale data does not generate movement.</p>}{change&&!valid&&<p role="status">This model-change link is unavailable or stale. The current outlook below is informational, not a CFP field projection.</p>}</aside>;
}
