"use client";
import {useEffect, useState} from 'react';
import {Radio} from 'lucide-react';
import './game-radio.css';
import directory from '../data/radio-directory-2026.json';

type Team = {id: string; name: string; homeAway?: string};
type Station = {id: string; name: string; embed?: boolean; url?: string; kind?: string};
const networks: Record<string, Station[]> = {
  '2633': [{id:'s230333',name:'Tennessee Football'},{id:'s29706',name:'107.7 WIVK'},{id:'s22278',name:'101.5 WQUT'},{id:'s30987',name:'92.9 ESPN Memphis'}],
  '142': [{id:'s231151',name:'Missouri Football'}],
  '254': [{id:'s207384',name:'Utah Football',embed:false}],
  '135': [{id:'s231155',name:'Minnesota Football'}],
  '239': [{id:'s230302',name:'Baylor Football'}],
  '194': [{id:'s230241',name:'Ohio State Football'}],
  '61': [{id:'s230235',name:'Georgia Football'}],
};
const official: Record<string, {name:string;status:string;sources:Station[]}> = directory;
export default function GameRadio({teams}:{teams:Team[]}) {
  const [favoriteIds,setFavoriteIds] = useState<string[]>([]);
  const [chosen,setChosen] = useState<string|null>(null);
  const [enabled,setEnabled] = useState(true);
  useEffect(() => {
    try {
      const preferences = JSON.parse(localStorage.getItem('fourth-down-alert-preferences-v1') || '{}');
      setFavoriteIds((preferences.favorites || []).map((team:Team) => team.id));
    } catch {}
  }, []);
  const available = [...teams].sort((a,b) =>
    Number(favoriteIds.includes(b.id))-Number(favoriteIds.includes(a.id)) ||
    Number(b.homeAway==='home')-Number(a.homeAway==='home'));
  const primaryTeam = available.find(team => official[team.id]?.sources.length || networks[team.id]);
  const stations = primaryTeam ? [
    ...(official[primaryTeam.id]?.sources || []),
    ...(networks[primaryTeam.id] || []),
  ].slice(0,4).map(station => ({...station,team:primaryTeam.name})) : [];
  const selected = stations.find(station => station.id===chosen) || stations[0];
  if (!selected) return (
    <section className="gameRadio"><h3><Radio size={18} aria-hidden="true"/>Live Game Radio</h3>
      <p>A verified radio link is not available for these teams yet.</p>
    </section>
  );
  return (
    <section className="gameRadio" aria-label="Live Game Radio">
      <h3><Radio size={18} aria-hidden="true"/>Live Game Radio</h3>
      <p>{selected.team} · {selected.url ? (selected.kind === 'guide' ? 'Official radio guide' : selected.kind === 'schedule' ? 'Official broadcast schedule' : 'Official listening page') : 'TuneIn backup'}</p>
      <div className="radioStations" role="group" aria-label="Radio stations">
        {stations.map(station => <button key={station.id} aria-pressed={selected.id===station.id}
          onClick={() => {setChosen(station.id);setEnabled(true);}}>{station.name}</button>)}
        {selected.embed !== false && <button onClick={() => setEnabled(value => !value)}>{enabled?'Close player':'Load player'}</button>}
      </div>
      {enabled && selected.embed !== false && <iframe key={selected.id} src={`https://tunein.com/embed/player/${selected.id}/`}
        title={selected.name+' radio player'} allow="autoplay" width="100%" height="100" scrolling="no"/>}
      <a className="radioOpen" href={selected.url || `https://tunein.com/radio/${selected.id}/`} target="_blank" rel="noopener noreferrer">{selected.embed === false ? (selected.kind === 'guide' ? 'Open radio guide' : selected.kind === 'schedule' ? 'Find broadcast' : 'Listen Live') : 'Open on TuneIn'} ↗</a>
      <small>{selected.embed === false ? selected.kind === 'schedule' ? 'Choose the football audio link on the school’s schedule. ' : 'The provider controls game availability and playback. ' : 'Use the provider’s Play control. If it is missing or playback fails, open TuneIn. '} Broadcasts may start near kickoff. Provider access or regional restrictions may apply. Affiliate stations may carry other programming outside games.</small>
    </section>
  );
}
