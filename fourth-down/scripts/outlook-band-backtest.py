"""Bounded audit of frozen poll-position bands, not future-result ranking adjustments.
Uses pre-selection publication dates. Outcome labels are evaluated only after bands are formed.
Previously inspected seasons remain retrospective development evidence, not unseen holdouts.
"""
import json,pathlib,urllib.request,datetime,hashlib
root=pathlib.Path('/Users/rick/Documents/ChatGPT/Fourth Down');out=root/'outputs/playoff-outlook-prototype';out.mkdir(exist_ok=True)
prior=json.loads((root/'outputs/selection-validation-nov2/report.json').read_text());targets={t['season']:t for t in json.loads((pathlib.Path(__file__).parent/'data/outlook-selection-targets.json').read_text())}
rows=[];requests=0
for window in prior['windows']:
 if not window.get('models'):continue
 season=window['season'];cutoff=datetime.datetime.fromisoformat(window['asOf'].replace('Z','+00:00'))
 first=datetime.datetime(season,9,1 if season==2024 else 7,tzinfo=datetime.timezone.utc)
 # Explicit schedule windows already used in the archived study.
 weeks={'2024-10-06':6,'2024-10-20':8,'2024-11-03':10,'2024-11-17':12,'2024-12-01':14,'2024-12-07':15,'2025-10-05':6,'2025-10-19':8,'2025-10-26':9,'2025-11-02':10,'2025-11-09':11,'2025-11-16':12,'2025-11-23':13,'2025-11-30':14,'2025-12-06':15,'2025-12-07':15}
 week=weeks[window['asOf'][:10]];path=out/f'poll-{season}-{week}.json';url=f'https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings?seasons={season}&weeks={week}&seasontypes=2'
 try:
  if not path.exists():
   if requests>=12:raise ValueError('Capture budget exhausted')
   requests+=1
   with urllib.request.urlopen(url,timeout=12) as r:path.write_bytes(r.read())
  raw=path.read_bytes();data=json.loads(raw);editions=[]
  for p in data.get('rankings',[]):
   if p.get('type') not in ['ap','usa','cfp'] or p.get('season',{}).get('year')!=season or not p.get('date'):continue
   date=datetime.datetime.fromisoformat(p['date'].replace('Z','+00:00'));ranks=p.get('ranks',[])
   if date>cutoff-datetime.timedelta(hours=24) or len(ranks)!=25 or len(set(str(r['team']['id']) for r in ranks))!=25:continue
   if sorted(r['current'] for r in ranks)!=list(range(1,26)):continue
   editions.append(p)
  poll=next((p for typ in ['cfp','ap','usa'] for p in editions if p['type']==typ),None)
  if not poll:raise ValueError('No complete untied dated edition before cutoff')
  order=sorted(poll['ranks'],key=lambda r:r['current']);forecast=[str(r['team']['id']) for r in order[:12]]
  # Target labels are used only after fixed bands/ordering are formed.
  actual=set(targets[season]['seeds']);bands={}
  for label,lo,hi in [('Likely In',1,8),('On the Bubble',9,16),('Outside Looking In',17,25)]:
   ids=[str(r['team']['id']) for r in order if lo<=r['current']<=hi];bands[label]={'teams':len(ids),'ultimatelySelected':sum(t in actual for t in ids)}
  rows.append({'season':season,'asOf':window['asOf'],'poll':poll['type'],'pollDate':poll['date'],'source':url,'sha256':hashlib.sha256(raw).hexdigest(),'bands':bands,'plainTop12Correct':len(set(forecast)&actual),'falseInclusions':[t for t in forecast if t not in actual],'missed':[t for t in actual if t not in forecast]})
 except Exception as e:rows.append({'season':season,'asOf':window['asOf'],'excluded':str(e)})
valid=[r for r in rows if 'bands'in r];aggregate={}
for label in ['Likely In','On the Bubble','Outside Looking In']:
 aggregate[label]={k:sum(r['bands'][label][k] for r in valid) for k in ['teams','ultimatelySelected']}
report={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Fixed1–8/9–16/17–25 published-poll bands; no result-driven rank adjustment','requests':requests,'windows':rows,'aggregate':aggregate,'plainTop12MeanCorrect':sum(r['plainTop12Correct'] for r in valid)/len(valid) if valid else None,'limitations':['Previously inspected2024/2025 seasons, not unseen validation.','Repeated weekly team observations are correlated.','Plain Top12 ignores season-specific automatic bids and is a control, not a field allocator.','Unranked teams are outside this band audit; Outside is not mathematical elimination.','No calibrated probabilities and no validation of how hypothetical future results change rankings.','2026 qualification differs from2024/2025; do not apply2026 allocation retrospectively.'],'publicForecastRecommendation':'NO-GO; private descriptive poll-anchored prototype only'}
(out/'band-backtest.json').write_text(json.dumps(report,indent=2));print(json.dumps({'validWindows':len(valid),'excluded':len(rows)-len(valid),'aggregate':aggregate,'plainTop12MeanCorrect':report['plainTop12MeanCorrect'],'requests':requests},indent=2))
