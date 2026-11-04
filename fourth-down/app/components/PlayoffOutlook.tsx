"use client";
import BracketPredictor,{type PlayoffSettings} from "./BracketPredictor";
import ConditionalBracket from "./ConditionalBracket";
import{useEffect,useState}from'react';import{pulseTeams}from'../lib/pulse-teams';import{teamOutlook,scenarioOrder,referenceField,rankingAssumptionPath,CFP_2026_PROTOCOL,conferenceLabel}from'../lib/playoff-outlook';import type{SandboxCatalog}from'../lib/multi-game-sandbox';import type{Poll}from'../lib/rankings';import './playoff-outlook.css';
const storageKey="fd:what-if-bracket:v1";
const emptySettings={champions:{} as Record<string,string>,eligibility:false,rankOffsets:{} as Record<string,number>,playoff:{picks:{},adjustments:{}} as PlayoffSettings};
function readSettings(): typeof emptySettings {
 try {
  const stored=JSON.parse(localStorage.getItem(storageKey)||"null");
  if(stored?.playoff?.picks && stored?.playoff?.adjustments && stored.champions && stored.rankOffsets) return stored;
 } catch {}
 return emptySettings;
}
export default function PlayoffOutlook({catalog,choices,teamId,poll,excluded,resetRegularSeason}:{catalog:SandboxCatalog;choices:{gameId:string;winnerId:string}[];teamId:string;poll:Poll|undefined;excluded:string[];resetRegularSeason:()=>void}){
 const [settings,setSettings]=useState(readSettings);
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}},[settings]);
 const {champions,eligibility,rankOffsets,playoff}=settings;
 const setChampions=(update:(old:Record<string,string>)=>Record<string,string>)=>setSettings(old=>({...old,champions:update(old.champions)}));
 const setEligibility=(value:boolean)=>setSettings(old=>({...old,eligibility:value}));
 const outlook=teamOutlook(catalog,choices,teamId,poll,excluded);
 const conferences=Object.fromEntries(pulseTeams.map(t=>[t.id,conferenceLabel(t.conference)]));
 const scenarioPoll=scenarioOrder(poll,catalog,choices,excluded);
 const projectedPoll=scenarioPoll && {...scenarioPoll,teams:[...scenarioPoll.teams].sort((a,b)=>
  a.rank+(rankOffsets[a.teamId]||0)-b.rank-(rankOffsets[b.teamId]||0)||a.rank-b.rank,
 ).map((team,index)=>({...team,rank:index+1}))};
 const assumptions={champions,eligibilityAssumed:eligibility};
 const field=referenceField(projectedPoll,conferences,assumptions);
 const path=rankingAssumptionPath(poll,conferences,assumptions,teamId);
 if(!outlook)return <p role="status">Choose a team with a complete current snapshot to explore its outlook.</p>;
 return <section className="outlookReview" aria-label="Private playoff outlook prototype"><p className="eyebrow">WHAT IF · MODELED OUTLOOK</p><div className="outlookHero"><div><span className="outlookBadge">{outlook.label}</span><h2>{outlook.name}</h2><p>{outlook.headline}</p></div><div className="outlookRecord"><strong>{outlook.after}</strong><span>Hypothetical overall</span><b>{outlook.conferenceAfter||'Unavailable'} conference</b></div></div><p>{outlook.why}</p><p><b>What changed:</b> {outlook.changes}</p><div className="outlookColumns"><div><h3>Why it matters</h3><ul><li>{outlook.before} → {outlook.after} overall; {outlook.conferenceBefore||'Unavailable'} → {outlook.conferenceAfter||'Unavailable'} conference.</li><li>{outlook.remainingUnselected} remaining team games have no assumed outcome.</li><li>Winning out does not automatically qualify this team for its conference championship.</li></ul><p><b>Schedule strength:</b> No verified schedule-adjusted SOS value is supplied by this snapshot. Opponent records remain supporting evidence, not an invented SOS ranking.</p><h4>Results against currently ranked teams</h4>{outlook.rankedResults.length?<ul>{outlook.rankedResults.map(r=><li key={r.gameId}>{r.result} against #{r.rank} {r.opponent} · {poll?.name} current-edition context, not rank at kickoff.</li>)}</ul>:<p>No ranked-result match is established by these captured game identities.</p>}{outlook.hypothetical.length>0&&<details><summary>Your assumed games</summary><ul>{outlook.hypothetical.map(g=><li key={g.gameId}>Assumed {g.won?'win':'loss'} against {g.opponent.name}. <a href={'/game/'+g.gameId}>Game Center</a></li>)}</ul></details>}</div><div><h3>What needs to happen?</h3><p>Strengthen the record, watch the teams around the cut line and resolve conference champions. Their results may change the committee’s evaluation; a loss by one rival does not guarantee your selection.</p>{outlook.peers.slice(0,4).map(p=><p key={p.id}><a href={'/team/'+p.id}>#{p.rank} {p.name}</a>{p.games[0]&&<> · <a href={'/game/'+p.games[0].id}>next game</a></>}</p>)}<a href={'/scenarios?team='+teamId}>Opponent Watch & all scenario tools →</a></div></div><div className="outlookActions"><button type="button" onClick={()=>{
 if(window.confirm("Reset regular-season picks, ranking edits, conference champions, ratings, and playoff picks?")){
  setSettings(emptySettings);resetRegularSeason();
 }
 }}>Reset All</button><span>Scenario changes save on this device.</span></div><details className="outlookFieldOptions" open><summary>Explore a conditional 12-team field</summary><p>Choose hypothetical conference champions explicitly. These are assumptions, not verified championship qualifiers. The scenario starts from the selected published poll and adjusts the order when picks change team records. This experimental adjustment is not an official poll or a probability.</p><button type="button" onClick={()=>{
 const ranked=[...(poll?.teams||[])].sort((a,b)=>a.rank-b.rank);
 setChampions(()=>Object.fromEntries(['ACC','Big Ten','Big 12','SEC'].map(conf=>[conf,ranked.find(t=>conferences[t.teamId]===conf)?.teamId||''])));
 setEligibility(true);
 }}>Use ranked teams as champion assumptions</button><div className="outlookChampionGrid">{['ACC','Big Ten','Big 12','SEC'].map(conf=><label key={conf}>{conf} champion assumption<select aria-label={conf+' champion assumption'} value={champions[conf]||''} onChange={e=>setChampions(old=>({...old,[conf]:e.target.value}))}><option value="">Not assumed</option>{catalog.teams.filter(t=>conferences[t.id]===conf).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>)}</div><label className="outlookConsent"><input type="checkbox" checked={eligibility} onChange={e=>setEligibility(e.target.checked)}/>Assume postseason eligibility for this illustration; it is not a completed eligibility audit.</label><details><summary>Edit projected rankings and power ratings</summary>
 <p>Ranking edits apply after your regular-season scenario. Power adjustments affect playoff matchup estimates without changing the published polls.</p>
 {projectedPoll?.teams.map(team=><div className="outlookRankControls" key={team.teamId}>
  <b>{team.rank}. {team.name}</b>
  <button type="button" aria-label={`Move ${team.name} up`} disabled={team.rank===1} onClick={()=>{
   const above=projectedPoll.teams[team.rank-2];
   const rank=(id:string)=>scenarioPoll?.teams.find(row=>row.teamId===id)?.rank ?? 0;
   setSettings(old=>({...old,rankOffsets:{...old.rankOffsets,
    [team.teamId]:rank(above.teamId)+(old.rankOffsets[above.teamId]||0)-rank(team.teamId)-0.01,
   }}));
  }}>↑</button>
  <button type="button" aria-label={`Move ${team.name} down`} disabled={team.rank===projectedPoll.teams.length} onClick={()=>{
   const below=projectedPoll.teams[team.rank];
   const rank=(id:string)=>scenarioPoll?.teams.find(row=>row.teamId===id)?.rank ?? 0;
   setSettings(old=>({...old,rankOffsets:{...old.rankOffsets,
    [team.teamId]:rank(below.teamId)+(old.rankOffsets[below.teamId]||0)-rank(team.teamId)+0.01,
   }}));
  }}>↓</button>
  <label>Power adjustment <input type="number" aria-label={`${team.name} power adjustment`} min={-50} max={50}
   value={playoff.adjustments[team.teamId]??0} onChange={event=>{
    const value=Math.min(50,Math.max(-50,Number(event.target.value)));
    setSettings(old=>({...old,playoff:{...old.playoff,adjustments:{...old.playoff.adjustments,[team.teamId]:value}}}));
   }}/></label>
 </div>)}
 </details>{field.status==='withheld'?<p role="status">{field.reason}</p>:<><h3>Projected field · selected results and champion assumptions</h3><p>Unpicked games leave records unchanged. The field adjusts to your selected outcomes under the stated assumptions.</p>{projectedPoll&&<ConditionalBracket seeds={field.teams} poll={projectedPoll} teamId={teamId}/>}{projectedPoll&&<BracketPredictor field={field.teams} order={projectedPoll.teams.map(t=>({id:t.teamId,name:t.name,rank:t.rank}))} settings={playoff} update={value=>setSettings(old=>({...old,playoff:value}))}/>}{path&&<aside aria-label="Ranking assumption required"><h4>What would put this team in with the published order as the starting point?</h4>{path.alreadyIncluded?<p>This team is already included under your explicit qualifier assumptions. That is not a confirmed berth or a prediction.</p>:<><p>In this illustration, moving from #{path.currentRank} to #{path.illustratedRank} in the <strong>{poll?.name} anchor</strong> would include {outlook.name}: {path.positions} positions, with other teams retaining their relative order.</p><p>This is an additional ranking assumption—not a forecast of how your game picks change future CFP votes. Automatic qualifiers can change the cut line.</p><p>Would enter: {path.entering.join(', ')}. Would leave: {path.leaving.join(', ')}.</p><details><summary>Show the field with that additional ranking assumption</summary><ol>{path.field.map(t=><li key={t.id}>{t.seed}. {t.name} · {t.reason}</li>)}</ol></details></>}</aside>}<p>First round: 5–12, 6–11, 7–10 and 8–9. A hypothetical field is not an official bracket.</p></>}</details><details><summary>Methodology, validation & limitations</summary><p>Reference baseline: captured published ranking, no predicted committee movement. Ranks 1–8 = Likely In; 9–16 = Bubble; 17+ or unranked = Outside. These descriptive bands are not validated likelihoods. The prior poll-anchored historical field proxy averaged 9.714/12 correct on seven inspected 2025 windows versus 9.0/12 for the experimental model; conference-leader proxies and correlated windows limit that comparison.</p><p>2026 automatic qualification is separate: four Power Four champions, the highest-ranked team from the other six conferences, Notre Dame when final CFP top 12, then remaining highest-ranked teams. Historical 2024/2025 qualification is evaluated under its own format.</p><ul>{outlook.limits.map(l=><li key={l}>{l}</li>)}</ul><p><a href={CFP_2026_PROTOCOL} target="_blank" rel="noopener noreferrer">Official 2026 selection protocol</a> · Snapshot {catalog.snapshotId} · {catalog.at}</p></details></section>;
}
