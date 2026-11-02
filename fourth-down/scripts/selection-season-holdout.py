"""Retrospective season holdout using frozen archived forecasts, no feature rebuild or tuning."""
import json,hashlib,pathlib,statistics,os
source=pathlib.Path(os.environ.get('SELECTION_SOURCE','/Users/rick/Documents/ChatGPT/Fourth Down/outputs/selection-validation-nov2/report.json'))
raw=source.read_bytes();report=json.loads(raw);windows=[w for w in report['windows'] if w.get('models')]
train=[w for w in windows if w['season']==2024];test=[w for w in windows if w['season']==2025]
assert train and test and max(w['asOf'] for w in train)<min(w['asOf'] for w in test)
ids=[m['id'] for m in train[0]['models'] if m['snapshotId'] is not None]
def metrics(ws,id):
 ms=[next(m for m in w['models'] if m['id']==id) for w in ws]
 return {'windows':len(ms),'meanSelected':statistics.mean(m['metrics']['selectedCorrect'] for m in ms),'meanAllActualSeedError':statistics.mean(m['metrics']['allActualSeedError'] for m in ms),'latestField':ms[-1]['metrics']['selectedCorrect'],'latestMissed':ms[-1]['metrics']['missedSelections']}
training={id:metrics(train,id) for id in ids}
# Selection rule fixed here: average field membership, then error penalizing missed teams, then ID.
selected=sorted(ids,key=lambda id:(-training[id]['meanSelected'],training[id]['meanAllActualSeedError'],id))[0]
controls=['candidate-35-35-10-20','published-poll-anchor',selected]
rows={id:{'development2024':metrics(train,id),'holdout2025':metrics(test,id)} for id in dict.fromkeys(controls)}
result={'sourceSha256':hashlib.sha256(raw).hexdigest(),'protocol':'Choose among existing frozen candidates on 2024 only; evaluate chosen configuration on 2025 without refitting','selectedCandidate':selected,'models':rows,'allTrainingCandidates':training,'conclusion':'No public selection forecast justified; poll comparison and qualification proxy limitations remain','limitations':['2025 labels were inspected in prior work: this is a retrospective out-of-season holdout, NOT a pristine unseen test.','Only two completed twelve-team seasons; weekly cutoffs are correlated.','Same unverified highest-ordered-team champion proxy in every forecast; missing champions can dominate membership errors.','Earlier polls are predictors of later committee behavior; independent resume quality is a different objective.','No weights, source features, scenario implementation or production configuration changed.']}
out=pathlib.Path(os.environ.get('HOLDOUT_REPORT','/Users/rick/Documents/ChatGPT/Fourth Down/outputs/selection-validation-nov2/season-holdout.json'));out.write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
