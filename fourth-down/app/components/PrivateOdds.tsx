'use client';
import './game-odds.css';
import {useEffect,useState} from 'react';
import type {OddsSnapshot} from '../lib/odds-provider';
import {easternGameDate} from '../lib/odds-matching';
type Game={id:string;date:string;status:string;name:string};
export default function PrivateOdds({game}:{game?:Game}){
 const [packet,setPacket]=useState<OddsSnapshot|null>(null),[message,setMessage]=useState('Loading odds…'),[book,setBook]=useState('DraftKings'),[needsApproval,setNeedsApproval]=useState(false),[approvalCode,setApprovalCode]=useState(''),[approving,setApproving]=useState(false),[revision,setRevision]=useState(0);
 const id=game?.id,date=game?easternGameDate(game.date):'';
 useEffect(()=>{
  if(!id)return;const controller=new AbortController();let active=true;
  async function load(){try{
   const fragment=new URLSearchParams(location.hash.slice(1)),approval=fragment.get('approve-odds');
   if(approval){history.replaceState(null,'',location.pathname+location.search+'#private-game-odds');
    const approved=await fetch('/api/private/odds/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approval}),signal:controller.signal});
    if(!approved.ok){if(active)setNeedsApproval(true);throw Error('This link was already used or expired. Approve this device with a new one-time code below.');}
   }
   const r=await fetch('/api/private/odds?'+new URLSearchParams({date,game:id!}),{cache:'no-store',signal:controller.signal}),body=await r.json();
   if(!active)return;
   if(r.status===401){setNeedsApproval(true);setMessage('Approve this browser or installed app once to see odds.');return;}
   if(!r.ok)throw Error('Pregame odds unavailable. No earlier prices are reconstructed.');
   setNeedsApproval(false);setPacket(body);setMessage(body.quotes?.length?'':'No pregame prices are available for this game.');
  }catch(error){if(active&&!controller.signal.aborted){setMessage(error instanceof Error?error.message:'Odds temporarily unavailable.');}}}
  void load();return()=>{active=false;controller.abort();};
 },[id,date,revision]);
 async function approveDevice(event:React.FormEvent){
  event.preventDefault();setApproving(true);
  try{const response=await fetch('/api/private/odds/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approval:approvalCode})});
   if(!response.ok)throw Error('Code expired, already used, or temporarily limited. Request a fresh approval code.');
   setApprovalCode('');setNeedsApproval(false);setMessage('Loading odds…');setRevision(n=>n+1);
  }catch(error){setMessage(error instanceof Error?error.message:'Device approval unavailable.');}finally{setApproving(false);}
 }

 const quotes=packet?.quotes||[],books=['DraftKings','FanDuel','BetMGM'],selected=books.includes(book)?book:'DraftKings',visible=quotes.filter(q=>q.book===selected);
 const selections=[...new Set(visible.filter(q=>q.market!=='total').map(q=>q.participant))];
 const show=(participant:string,market:'moneyline'|'spread')=>{const q=visible.find(q=>q.participant===participant&&q.market===market);return q?`${q.line? q.line+' ':''}${q.american}`:'—';};
 const totals=visible.filter(q=>q.market==='total');
 const captured=quotes.length?new Date(Math.max(...quotes.map(q=>Date.parse(q.capturedAt||packet!.observedAt)))).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'';
 const updated=visible.length?new Date(Math.max(...visible.map(q=>Date.parse(q.updatedAt)))).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'';
 return <section className="gameOdds" aria-label="Odds"><div className="gameOddsHeader"><h2>Odds</h2>{quotes.length>0&&<label>Book <select aria-label="Sportsbook" value={selected} onChange={e=>setBook(e.target.value)}>{books.map(b=><option key={b}>{b}</option>)}</select></label>}</div>
 {quotes.length>0?<>{visible.length?<><table><thead><tr><th>Team</th><th>Moneyline</th><th>Spread</th></tr></thead><tbody>{selections.map(p=><tr key={p}><th scope="row">{p}</th><td>{show(p,'moneyline')}</td><td>{show(p,'spread')}</td></tr>)}</tbody></table><div className="gameOddsTotal"><strong>Total</strong> {totals.length?totals.map(q=>`${q.participant} ${q.line} (${q.american})`).join(' · '):'Unavailable'}</div><p className="gameOddsNote">Prices updated {updated}</p></>:<p>No captured prices from {selected}.</p>}<p className="gameOddsNote">Pregame snapshot · Captured {captured} · Delayed ≥5 min</p></>:<p role="status" className="gameOddsNote">{message}</p>}
 {needsApproval&&<form className="oddsDeviceApproval" onSubmit={approveDevice}><label>One-time approval code<input aria-label="One-time approval code" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} required maxLength={64} value={approvalCode} onChange={event=>setApprovalCode(event.target.value)}/></label><button disabled={approving}>{approving?'Approving…':'Approve this device'}</button><p className="gameOddsNote">Enter the code here in the app you want to use. This device will be remembered; no hourly sign-in.</p></form>}
 <a className="gameOddsSource" href="https://therundown.io" target="_blank" rel="noopener noreferrer">Data provided by TheRundown</a></section>;
}
