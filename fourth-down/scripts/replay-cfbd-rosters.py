"""Replay CFBD-derived annual roster/schedule exports privately. Does not call the API."""
import argparse
import collections
import csv
import json
import os
from pathlib import Path
import sqlite3
import time
import pulse_cfbd_schedule as worker


def replay(rosters,schedules,db,season,now):
    inventory={x['id']:x['name'] for x in json.loads(worker.SCHOOLS.read_text())['teams']}
    ids=collections.defaultdict(set)
    for game in csv.DictReader(schedules):
        if game['season']!=str(season): continue
        for side in ('home','away'):
            team_id=game[side+'_id']
            if team_id in inventory and game[side+'_division']=='fbs':
                ids[worker.clean(game[side+'_team'])].add(team_id)
    mapping={school:next(iter(keys)) for school,keys in ids.items() if len(keys)==1}
    rows=({'id':r['athlete_id'],'team':r['team'],'lastName':r['last_name'],'position':r['position']} for r in
          csv.DictReader(rosters) if r['season']==str(season))
    teams=worker.project('/roster',rows,mapping,season)
    worker.initialize(db)
    worker.publish(db,f'{season}/roster','/roster',teams,now,'CFBD via cfbfastR annual roster export')
    return teams

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for key in ('rosters','schedules','directory'): p.add_argument('--'+key,type=Path,required=True)
    p.add_argument('--season',type=int,required=True)
    args=p.parse_args()
    if args.directory.resolve().is_relative_to(Path(__file__).resolve().parents[2]):
        p.error('Choose a private replay directory outside the repository.')
    os.umask(0o077)
    args.directory.mkdir(mode=0o700,parents=True,exist_ok=True)
    with sqlite3.connect(args.directory/'replay.sqlite') as db, args.rosters.open() as roster,args.schedules.open() as schedule:
        teams=replay(roster,schedule,db,args.season,int(time.time()))
        worker.export_team_views(db,args.directory/'views',args.season,args.season+1)
        print('Matched FBS programs:',len(teams))
