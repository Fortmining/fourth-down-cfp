"""Build version-pinned 2024/2025 résumé inputs. No current-season data or postgame ratings.
SHADOW_HISTORY points outside the repository and contains historical-manifest.json.
Git commit dates are archival evidence, not first ESPN publication timestamps.
"""
import os, json, csv, io, hashlib, pathlib, urllib.request, datetime
root = pathlib.Path(os.environ['SHADOW_HISTORY']).resolve()
if root.is_relative_to(pathlib.Path(__file__).resolve().parents[2]):
    raise ValueError('Use private output directory outside repository')
root.mkdir(parents=True,exist_ok=True)
manifest_file=pathlib.Path(os.environ.get('SHADOW_HISTORY_MANIFEST',str(root/'historical-manifest.json')))
if not manifest_file.exists():manifest_file=pathlib.Path(__file__).resolve().parent/'data/historical-vintages-2025.json'
manifest = json.loads(manifest_file.read_text())
weeks = {'2025-10-05':6,'2025-10-19':8,'2025-10-26':9,'2025-11-02':10,'2025-11-09':11,'2025-11-16':12,'2025-11-23':13,'2025-11-30':14,'2025-12-07':15,'2025-12-06':15}
conferences = {'ACC':'1','Big 12':'4','Big Ten':'5','SEC':'8','American Athletic':'151','Conference USA':'12','Mid-American':'15','Mountain West':'17','Sun Belt':'37','FBS Independents':'18','Pac-12':'9'}
def dt(s): return datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
def get(url, dest):
    if not dest.exists():
        with urllib.request.urlopen(url,timeout=25) as r: dest.write_bytes(r.read())
    return dest.read_bytes()
outputs = []; exclusions=[]
for m in manifest:
    at = m['date']; epoch=dt(at); season=int(m.get('season',2025))
    if season not in (2024,2025):raise ValueError('Unsupported historical season')
    raw = get(m['download'],root/(m['sha']+'.csv'))
    blob = hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    if blob != m['blob']: raise ValueError('Historical Git blob hash mismatch')
    rows=list(csv.DictReader(io.StringIO(raw.decode())))
    rows=[r for r in rows if r['season']==str(season) and (r['home_division']=='fbs' or r['away_division']=='fbs')]
    teams={}
    for r in rows:
        for side in ['home','away']:
            if r[side+'_division']=='fbs':
                tid=r[side+'_id']; conf=conferences[r[side+'_conference']]
                if tid in teams and teams[tid]['conference']!=conf: raise ValueError('Historical membership conflict')
                teams[tid]={'id':tid,'name':r[side+'_team'],'conference':conf,'eligible':None}
    games=[]; future_finals=[]; invalid_finals=[]
    for r in rows:
        ids=[r['home_id'],r['away_id']]
        if any(not x.isdigit() or int(x)<=0 for x in ids) or len(set(ids))!=2: continue
        completed=r['completed']=='TRUE'; scores=[]
        for k in ['home_points','away_points']:
            try: scores.append(int(r[k]))
            except (ValueError,TypeError): scores.append(None)
        if completed and dt(r['start_date'])>epoch: future_finals.append(r['game_id']);continue
        valid=completed and all(x is not None and x>=0 for x in scores) and scores[0]!=scores[1]
        if completed and not valid: invalid_finals.append(r['game_id'])
        games.append({'id':r['game_id'],'season':season,'date':r['start_date'],'state':'post' if completed else 'pre','completed':completed,'teams':ids,'scores':scores if valid else [None,None],'winner':ids[0 if scores[0]>scores[1] else 1] if valid else None,'conferenceGame':r['conference_game']=='TRUE','period':None,'clock':None,'observedAt':at,'source':'cfbfastR-data Git '+m['sha']})
    if future_finals: raise ValueError('Future outcomes in committed vintage: '+','.join(future_finals))
    week=m.get('week') or weeks[at[:10]]
    url='https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings?seasons='+str(season)+'&weeks='+str(week)+'&seasontypes=2'
    poll_file=root/('poll-'+str(season)+'-week-'+str(week)+'.json');poll=json.loads(get(url,poll_file));editions=[]
    unsupported=[p.get('type') for p in poll.get('rankings',[]) if p.get('type') in ['ap','usa','cfp'] and len(p.get('ranks',[]))!=25]
    if unsupported:
        exclusions.append({'sha':m['sha'],'date':at,'season':season,'reason':'Official tied/incomplete edition unsupported by frozen v1.1 anchor validator; entire vintage excluded, no ranked team dropped','pollTypes':unsupported})
        continue
    counts={tid:sum(g['state']=='post' and tid in g['teams'] for g in games) for tid in teams}
    for p in poll.get('rankings',[]):
        if p.get('type') not in ['ap','usa','cfp']: continue
        if p['season']['year']!=season or dt(p['date'])>epoch-datetime.timedelta(hours=24): raise ValueError('Wrong season or poll too near cutoff to establish release')
        ranks=[{'id':str(x['team']['id']),'rank':x['current'],'previous':x.get('previous') or None,'record':x.get('recordSummary','')} for x in p['ranks']]
        if len(ranks)!=25 or len({r['id'] for r in ranks})!=25 or any(r['id'] not in teams for r in ranks): raise ValueError('Incomplete historical edition')
        for r in ranks:
            if r['record'] and sum(int(x) for x in r['record'].split('-'))>counts[r['id']]: raise ValueError('Publication record exceeds as-of ledger; possible future data')
        editions.append({'id':'ap' if p['type']=='ap' else 'coaches' if p['type']=='usa' else 'cfp','date':p['date'],'season':season,'ranks':ranks})
    if not {'ap','coaches'}.issubset({e['id'] for e in editions}):raise ValueError('AP/Coaches historical edition missing')
    inputs={'season':season,'observedAt':at,'teams':sorted(teams.values(),key=lambda t:int(t['id'])),'games':sorted(games,key=lambda g:(g['date'],g['id'])),'editions':editions,'coverage':{'complete':not invalid_finals,'futureComplete':False,'issues':['Invalid/missing archived final scores: '+','.join(invalid_finals)] if invalid_finals else []},'rulesVersion':'historical-resume-no-qualification-v1'}
    dest=root/('inputs-'+m['sha']+'.json');dest.write_text(json.dumps(inputs,indent=2))
    outputs.append({**m,'inputsFile':str(dest),'teams':len(teams),'games':len(games),'finals':sum(g['completed'] and g['winner'] is not None for g in games),'invalidFinals':invalid_finals,'pollSource':url,'pollSHA256':hashlib.sha256(poll_file.read_bytes()).hexdigest(),'pollDates':[e['date'] for e in editions],'excludedColumns':['home_post_win_prob','away_post_win_prob','home_pregame_elo','away_pregame_elo','home_postgame_elo','away_postgame_elo','excitement_index'],'limitation':'Git commit metadata establishes the archived version; polls are historical publication snapshots retrieved later, not archived wire-delivery timestamps'})
(root/'prepared-vintages.json').write_text(json.dumps(outputs,indent=2))
(root/'historical-preparation-exclusions.json').write_text(json.dumps(exclusions,indent=2))
print(json.dumps([{k:v for k,v in x.items() if k in ['sha','date','teams','games','finals','pollDates']} for x in outputs],indent=2))
