/* Standalone review UI. No preferences, push APIs, service workers or network calls. */
const {views,icons}=JSON.parse(document.getElementById('payload').textContent);
const get=id=>document.getElementById(id);
let key='replay',limit=20,pollKey='ap',showFullPoll=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pubDate=s=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const captureDate=s=>new Date(s).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'});
const gameDate=s=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'});
const gameLink=(id,label)=>'<a href="https://fourth-down-cfp.vercel.app/game/'+encodeURIComponent(id)+'">'+esc(label)+'</a>';
const teamLink=(id,label)=>'<a href="https://fourth-down-cfp.vercel.app/team/'+encodeURIComponent(id)+'">'+esc(label)+'</a>';
const record=s=>s?s.replaceAll('-','–'):'Unavailable';
const initials=r=>({'2633':'TENN','87':'ND','130':'MICH','194':'OSU','2641':'TTU','2390':'MIA'}[r.id]||r.name.split(' ').slice(0,2).map(w=>w[0]).join(''));
const pollName=id=>({ap:'AP',coaches:'Coaches',cfp:'CFP'}[id]||id);
const pollChange=n=>n===null?'Comparison unavailable':n===0?'No poll change':n>0?'↑ '+n:'↓ '+Math.abs(n);
function footballText(reason){
 if(reason.kind==='result')return reason.text.replace('Confirmed final: win vs ','Beat ').replace('Confirmed final: loss vs ','Lost to ').replace('Corrected final: win vs ','Corrected result: beat ').replace('Corrected final: loss vs ','Corrected result: lost to ');
 if(reason.kind==='poll')return 'A new published poll also changed this team’s experimental resume comparison. Official poll movement is shown separately.';
 if(reason.kind==='opponent')return reason.text.replace('changed its confirmed record; the value of this earlier','added new results, changing the value of an earlier');
 return reason.text.replace('Display order changed within tied model scores; this is not a measured gain in resume strength.','This team is tied in the comparison. Its display order changed without a measured gain in strength.').replace("Relative resume order changed while this team's own score stayed the same.","Other teams moved around this team while its own resume strength stayed the same.");
}
function story(row,compact=false){
 const direct=row.reasons.filter(r=>r.kind==='result');
 let selected=direct.length?direct.slice(-2):row.reasons.slice(0,1);
 if(!compact&&direct.length&&row.reasons.some(r=>r.kind==='poll'))selected=[...selected,row.reasons.find(r=>r.kind==='poll')];
 if(!selected.length)return row.movement===null?'We need two complete, comparable updates to explain movement.':'No new confirmed results or poll effects between these saved updates.';
 return selected.map(footballText).join(' ')+(compact&&direct.length&&row.reasons.some(r=>r.kind==='poll')?' Published polls also changed.':'');
}
const moveLabel=row=>row.movement===null?'Unavailable':row.movement===0?(row.reasons.length?'Held position · new evidence':'No change'):(row.movement>0?'Up ':'Down ')+Math.abs(row.movement)+' places';
function moverRow(row){return '<button class="mover" type="button" data-open-team="'+esc(row.id)+'" aria-label="View '+esc(row.name)+' Team Resume, '+(row.movement>0?'up ':'down ')+Math.abs(row.movement)+' resume places"><span class="team-monogram" aria-hidden="true">'+esc(initials(row))+'</span><span><strong>'+esc(row.name)+'</strong><span class="reason">'+esc(story(row,true))+'</span></span><span class="move-value">'+icons[row.movement>0?'ArrowUpRight':'ArrowDownRight']+Math.abs(row.movement)+'</span></button>';}
function renderMovers(v){
 const candidates=v.rows.filter(r=>r.resumePosition!==null&&r.resumePosition<=35&&r.movement!==null&&!r.modelTie&&Math.abs(r.scoreDelta??0)>0.000001);
 const up=candidates.filter(r=>r.movement>0).sort((a,b)=>b.movement-a.movement).slice(0,3),down=candidates.filter(r=>r.movement<0).sort((a,b)=>a.movement-b.movement).slice(0,3);
 get('comparison').textContent=v.comparison==='comparable'?'Confirmed changes: '+captureDate(v.previousAt)+' → '+captureDate(v.at)+'. '+(key==='replay'?'Archived replay, not today’s games.':'Saved updates, not a live feed.'):'Movement is unavailable until we have two complete, comparable updates.';
 const otherChanges=v.rows.some(r=>r.movement!==null&&(r.movement!==0||Math.abs(r.scoreDelta??0)>0.000001));
 if(!up.length&&!down.length){get('movement-content').innerHTML='<div class="empty-state"><h3>'+(v.comparison==='comparable'?(otherChanges?'No featured top-35 movers.':'The race is holding steady.'):'No confirmed comparison yet.')+'</h3><p>'+(v.comparison==='comparable'?(otherChanges?'Other teams may have updates outside the featured comparison. Search the Team Resumes below.':'No Resume Ranking movement between these saved updates. Official poll changes are shown separately below.'):'Incomplete or incompatible records prevent a reliable movement comparison. Existing results remain available where verified.')+'</p><button type="button" class="outline-button" data-replay>Watch the 2025 movement replay '+icons.ArrowRight+'</button></div>';return;}
 get('movement-content').innerHTML='<div class="mover-columns"><div class="mover-group positive"><h3>'+icons.ArrowUpRight+'MOVING UP</h3>'+up.map(moverRow).join('')+'</div><div class="mover-group negative"><h3>'+icons.ArrowDownRight+'SLIPPING</h3>'+down.map(moverRow).join('')+'</div></div><p class="meta" style="margin-top:10px">Largest position changes among the top 35 in this experimental comparison. Tied-score shifts are excluded. A rise is not a playoff bid; a fall is not elimination.</p>';
}
function teamCard(row,v){
 const orderedWins=[...row.wins].sort((a,b)=>(b.opponentStrength??-1)-(a.opponentStrength??-1));
 const orderedLosses=[...row.losses].sort((a,b)=>(a.opponentStrength??2)-(b.opponentStrength??2));
 const win=orderedWins[0],loss=orderedLosses[0];
 const ownPolls=v.officialEditions.flatMap(e=>{const rank=e.ranks.find(r=>r.id===row.id);return rank?[{...rank,poll:e.id,date:e.date}]:[]});
 const pollChips=ownPolls.length?ownPolls.map(p=>'<span class="poll-chip" data-poll="'+esc(p.poll)+'" data-rank="'+p.rank+'">'+esc(pollName(p.poll))+' #'+p.rank+' · '+esc(pollChange(p.movement))+'</span>').join(''):'<span>No Top 25 place in the available editions</span>';
 const strength=row.overall===null?'Complete record unavailable.':row.losses.length===0&&row.wins.length?'Unbeaten in '+row.wins.length+' confirmed games.':win?gameLink(win.gameId,'Beat '+win.opponent+', '+win.score)+'.':'No verified win available.';
 const concern=row.overall===null?'Incomplete data; overall assessment withheld.':loss?gameLink(loss.gameId,'Lost to '+loss.opponent+', '+loss.score)+'.':'No confirmed losses. Opponent and schedule context still matter.';
 const missingOpponents=row.wins.some(w=>w.opponentStrength===null||w.opponentRecord===null);
 const results=list=>list.length?list.map(r=>'<div class="result-line">'+gameLink(r.gameId,r.outcome+' vs '+r.opponent+' · '+r.score)+'<small>Opponent record: '+esc(record(r.opponentRecord))+(r.corrected?' · Corrected final':'')+'</small></div>').join(''):'<p>No confirmed results in this category.</p>';
 const context=v.reviewTeams.find(t=>t.id===row.id)?.context;
 const limitations=[row.recordLabel,row.eligibility,missingOpponents?'Some opponent records are unavailable. Do not treat missing evidence as a weak opponent.':'',row.modelTie?'Tied comparison: display position is not a measured difference in strength.':'',row.conferencePosition===null?'Conference place is unavailable or not applicable.':'Conference place uses win percentage, with ties kept. It is not a championship seed.'].filter(Boolean);
 return '<article class="team-card" data-team="'+esc(row.id)+'"><div class="team-head"><span class="team-monogram" aria-hidden="true">'+esc(initials(row))+'</span><div><h3>'+teamLink(row.id,row.name)+'</h3><p class="conference">'+esc(row.conference)+(row.conferencePosition!==null?' · Conference place '+row.conferencePosition+' (ties kept)':'')+'</p></div><div class="team-record"><strong>'+esc(record(row.overall))+'</strong><span>'+(row.conference==='Independent'?'Independent':esc(record(row.conferenceRecord))+' conference')+'</span></div></div>'+(row.overall===null?'<p class="data-warning">Incomplete record — complete assessment unavailable.</p>':'')+'<div class="resume-band"><div><strong>Resume Ranking '+(row.resumePosition===null?'unavailable':'#'+row.resumePosition)+'</strong><small>EXPERIMENTAL · NOT A PLAYOFF SEED</small></div><span class="movement '+(row.movement>0?'up':row.movement<0?'down':'')+'" aria-label="Resume Movement">'+esc(moveLabel(row))+'</span></div><div class="poll-chips"><strong>OFFICIAL POLLS</strong>'+pollChips+'</div><div class="insights"><div class="insight"><div class="insight-label">Resume Strength</div><p>'+strength+'</p></div><div class="insight"><div class="insight-label">Resume Concern</div><p>'+concern+'</p></div></div><div class="change-story"><strong>What Changed Your Resume?</strong>'+esc(story(row))+'</div><details class="evidence"><summary>Biggest wins, losses & the full explanation</summary><div class="evidence-body">'+(context?'<p>'+esc(context)+'</p>':'')+'<h4>Leading wins by opponent record</h4>'+results(orderedWins.slice(0,3))+'<h4>Confirmed losses</h4>'+results(row.losses)+'<h4>Every supported change</h4>'+(row.reasons.length?row.reasons.map(r=>'<p>'+esc(footballText(r))+' '+r.gameIds.map(id=>gameLink(id,'Game details')).join(' · ')+'</p>').join(''):'<p>'+esc(story(row))+'</p>')+'<div class="data-warning"><strong>Data & comparison limits</strong><p>'+limitations.map(esc).join(' ')+'</p><p>Official poll editions: '+(ownPolls.length?ownPolls.map(p=>esc(pollName(p.poll))+' published <time datetime="'+esc(p.date)+'">'+esc(pubDate(p.date))+'</time>').join(' · '):'not available')+'. Publication dates use UTC.</p></div></div></details><details class="evidence"><summary>Remaining games & conditional paths</summary><div class="evidence-body"><p>'+esc(row.scheduleLabel)+'</p>'+(row.remaining.length?row.remaining.map(g=>'<div class="result-line">'+gameLink(g.gameId,g.opponent+' · '+gameDate(g.date))+'<small>Opponent '+esc(record(g.opponentRecord))+(g.conferenceGame?' · Conference game':'')+' · Kickoff time unverified</small><p>'+esc(g.importance)+(g.officialRanks.length?' Ranked at capture: '+g.officialRanks.map(p=>esc(pollName(p.poll))+' #'+p.rank).join(', ')+'. Future polls may change.':'')+'</p></div>').join(''):'<p>No verified remaining fixtures in this capture.</p>')+(row.pendingCount?'<p>'+row.pendingCount+' conditional slot(s) still have unassigned opponents.</p>':'')+'<p>Dates use Eastern time. These are schedule opportunities, not predicted wins or playoff probabilities.</p></div></details></article>';
}
function renderTeams(v){
 const query=get('search').value.trim().toLowerCase(),all=get('all-teams').checked;
 const rows=query||all?v.rows.filter(r=>r.name.toLowerCase().includes(query)):v.reviewTeams.map(t=>v.rows.find(r=>r.id===t.id)).filter(Boolean);
 get('review-teams').innerHTML=v.reviewTeams.map(t=>{const r=v.rows.find(r=>r.id===t.id);return '<button type="button" data-open-team="'+esc(t.id)+'" aria-pressed="'+(query===r.name.toLowerCase())+'">'+esc(r.name.replace(/ Volunteers| Fighting Irish| Red Raiders| Hurricanes| Buckeyes| Wolverines/g,''))+'</button>';}).join('');
 get('count').textContent=rows.length?'Showing '+Math.min(limit,rows.length)+(all||query?' of '+rows.length+' matching teams':' review teams')+'.':'No teams match your search.';
 get('cards').innerHTML=rows.length?rows.slice(0,limit).map(r=>teamCard(r,v)).join(''):'<div class="empty-state"><h3>No team found.</h3><p>Try a school name or clear the search to return to the featured teams.</p><button type="button" class="outline-button" data-clear-search>Clear search</button></div>';
 get('more').hidden=rows.length<=limit;
}
function renderPolls(v){
 const edition=v.officialEditions.find(e=>e.id===pollKey)||v.officialEditions[0];pollKey=edition?.id??'ap';
 get('poll-tabs').innerHTML=v.officialEditions.map(e=>'<button type="button" data-official-poll="'+esc(e.id)+'" aria-pressed="'+(e.id===pollKey)+'">'+esc(pollName(e.id))+'</button>').join('');
 get('poll-date').innerHTML=edition?esc(pollName(edition.id))+' Top 25 · Published <time datetime="'+esc(edition.date)+'">'+esc(pubDate(edition.date))+'</time> (UTC publication date)':'No verified published edition is available in this capture.';
 get('poll-list').innerHTML=edition?edition.ranks.slice(0,showFullPoll?undefined:8).map(rank=>{const row=v.rows.find(r=>r.id===rank.id);return '<div class="poll-row" data-poll-team="'+esc(rank.id)+'" data-poll-rank="'+rank.rank+'"><span class="poll-place">'+rank.rank+'</span>'+teamLink(rank.id,row?.name??'Team '+rank.id)+'<span class="poll-change">'+esc(pollChange(rank.movement))+'</span></div>';}).join(''):'';
 get('poll-more').hidden=!edition||edition.ranks.length<=8;get('poll-more').textContent=showFullPoll?'Show fewer teams':'Show full Top 25';
 get('cfp-note').textContent=v.officialEditions.some(e=>e.id==='cfp')?'Saved CFP edition available.':'No CFP edition in this saved capture. It has not been replaced with an experimental ranking.';
}
function render(){
 const v=views[key];get('dataset').value=key;get('hero-title').innerHTML=key==='replay'?'The race <em>changed.</em>':'The race, <em>at a glance.</em>';
 get('capture').textContent=(key==='replay'?'Archived 2025 replay':'Saved 2026 update')+' · '+captureDate(v.at)+(key==='current'?' · Not a live feed':'');
 get('season').innerHTML=(key==='replay'?'2025':'2026')+' <small>'+(key==='replay'?'SEASON REPLAY':'SAVED UPDATE')+'</small>';
 renderMovers(v);renderTeams(v);renderPolls(v);
 get('championship').textContent=v.championshipScenario.text;
 get('live').textContent=v.liveScenario?'Conditional only: '+v.liveScenario.label+'. '+v.liveScenario.assumptions.length+' explicitly recorded assumptions. Confirmed records stay unchanged.':'No supported live assumption in this saved capture. No winner is invented.';
 get('source-notes').textContent=key==='replay'?'Historical replay: the algorithm was developed later using genuine archived inputs. These are not forecasts published in 2025. The October 19 capture predates that Sunday’s new poll, so its latest saved AP/Coaches editions are October 12.':'The current view compares two saved 2026 captures. It is not continuously updated. No new confirmed evidence means no invented movement.';
 if(v.issues.length)get('source-notes').textContent+=' Data checks: '+v.issues.join(' ');
 get('identity').textContent='Model '+v.modelVersion+' · Snapshot '+v.snapshotId+' · Source inputs '+v.sourceInputHash+' · Comparison '+v.comparison+'.';
}
function openTeam(id){const row=views[key].rows.find(r=>r.id===id);if(!row)return;get('search').value=row.name;limit=20;renderTeams(views[key]);get('team-title').focus({preventScroll:true});get('teams').scrollIntoView({block:'start',behavior:'instant'});}
get('dataset').addEventListener('change',e=>{key=e.target.value;get('search').value='';get('all-teams').checked=false;showFullPoll=false;limit=20;render();});
get('search').addEventListener('input',()=>{limit=20;renderTeams(views[key]);});get('all-teams').addEventListener('change',()=>{limit=20;renderTeams(views[key]);});get('more').addEventListener('click',()=>{limit+=20;renderTeams(views[key]);});
get('poll-more').addEventListener('click',()=>{showFullPoll=!showFullPoll;renderPolls(views[key]);});
document.addEventListener('click',e=>{
 const team=e.target.closest('[data-open-team]');if(team){openTeam(team.dataset.openTeam);return;}
 if(e.target.closest('[data-replay]')){key='replay';get('search').value='';get('all-teams').checked=false;limit=20;render();get('movement-title').scrollIntoView({block:'start'});return;}
 if(e.target.closest('[data-clear-search]')){get('search').value='';limit=20;renderTeams(views[key]);get('search').focus();return;}
 const poll=e.target.closest('[data-official-poll]');if(poll){pollKey=poll.dataset.officialPoll;showFullPoll=false;renderPolls(views[key]);return;}
 const appearance=e.target.closest('button[data-appearance]');if(appearance){document.querySelector('.shell').dataset.appearance=appearance.dataset.appearance;document.querySelectorAll('button[data-appearance]').forEach(b=>b.setAttribute('aria-pressed',String(b===appearance)));}
});
get('colorway').addEventListener('change',e=>document.querySelector('.shell').dataset.theme=e.target.value);
render();
