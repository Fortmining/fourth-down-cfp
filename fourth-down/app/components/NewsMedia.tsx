"use client";
import {useState} from 'react';import {Play,Newspaper} from 'lucide-react';
export default function NewsMedia({url,title,kind,sample,attribution}:{url:string|null;title:string;kind:string;sample:boolean;attribution?:string}){
 const [failed,setFailed]=useState(false);
 if(url&&!failed)return <figure className="newsMedia"><img src={url} alt={title} width="640" height="360" loading="lazy" onError={()=>setFailed(true)}/>{attribution&&<figcaption>{attribution}</figcaption>}</figure>;
 return <div className={'newsMedia newsMediaFallback '+((kind==='highlight'||kind==='video')?'videoFallback':'articleFallback')} role="img" aria-label={sample?'Branded sample placeholder; no image of a real event':'Branded placeholder; publisher image unavailable'}><span className="mediaBrand">4TH · PULSE</span>{(kind==='highlight'||kind==='video')?<Play size={36} fill="currentColor"/>:<Newspaper size={32}/>}<span>{sample?((kind==='highlight'||kind==='video')?'SAMPLE HIGHLIGHT':'SAMPLE STORY'):'PREVIEW UNAVAILABLE'}</span><small>{sample?'No published event is depicted':'Open the verified original source'}</small></div>;
}
