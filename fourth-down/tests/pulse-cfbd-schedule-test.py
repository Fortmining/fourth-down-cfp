import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import pulse_cfbd_schedule as engine
import pulse_cfbd_mirror as mirror


class Editions(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.root=Path(self.folder.name)
        self.db=sqlite3.connect(self.root/'state.sqlite')
        engine.initialize(self.db)
        self.scope='2026/player/portal'
        self.map={'tennessee':'2633','georgia':'61'}

    def tearDown(self):
        self.db.close()
        self.folder.cleanup()

    def record(self, dest, when):
        rows=[dict(firstName='Test',lastName='Player',origin='Tennessee',destination=dest,
                   position='DB',season=2026,transferDate='2026-03-01')]
        teams=engine.project('/player/portal',rows+rows,self.map,2026)
        return engine.publish(self.db,self.scope,'/player/portal',teams,when,'test provider')

    def test_restart_revision_replacement_and_missing_school(self):
        self.record('Georgia',100)
        self.db.close()
        self.db=sqlite3.connect(self.root/'state.sqlite')
        self.record('Georgia',110)
        self.assertEqual(2,self.db.execute('select count(*) from cf_editions').fetchone()[0])
        self.record('',120)
        self.assertFalse(self.record('Georgia',105))
        engine.export_team_views(self.db,self.root/'views',2026,2027)
        a=json.loads((self.root/'views/2633.json').read_text())['datasets']['transfers']
        b=json.loads((self.root/'views/61.json').read_text())['datasets']['transfers']
        self.assertEqual((a['revision'],a['value']['outgoing']['count']),(2,1))
        self.assertFalse(b['inLatest'])
        self.assertEqual(b['observedAt'],110)
        self.assertNotIn('facts',str(a))

    def test_conflicting_player_rows_roll_back_the_entire_edition(self):
        data={'61':[{'id':'1','position':'DB'}],'2633':[{'id':'2','position':'QB'}]}
        engine.publish(self.db,'2026/roster','/roster',data,100,'test')
        data['2633']=[{'id':'2','position':'LB'}]
        data['61'].append({'id':'1','position':'OL'})
        with self.assertRaises(ValueError):
            engine.publish(self.db,'2026/roster','/roster',data,200,'test')
        self.assertEqual(self.db.execute('select count(*),max(revision) from cf_editions').fetchone(),(2,1))
        self.assertEqual(self.db.execute('select checked from cf_checks').fetchone()[0],100)

    def test_rolling_budget_and_external_quota(self):
        now=10_000_000
        self.assertFalse(engine.reserve(self.db,self.scope,'/player/portal',now))
        self.assertTrue(engine.reserve(self.db,'/info','/info',now))
        self.db.execute('update cf_quota set sampled=?,remaining=1000',(now,))
        self.db.commit()
        self.assertTrue(engine.reserve(self.db,self.scope,'/player/portal',now))
        self.assertFalse(engine.reserve(self.db,self.scope,'/player/portal',now+1))
        self.db.executemany('insert into cf_calls values(?,?)',[(now-3*engine.DAY,'other')]*248)
        self.db.commit()
        self.assertFalse(engine.reserve(self.db,'roster','/roster',now))
        self.db.execute('delete from cf_calls')
        self.db.execute('update cf_quota set remaining=100')
        self.db.commit()
        self.assertFalse(engine.reserve(self.db,'roster','/roster',now))

    def test_controlled_admission_preserves_normal_daily_and_monthly_limits(self):
        now=10_000_000
        self.db.execute('update cf_quota set sampled=?,remaining=982',(now,))
        self.db.executemany('insert into cf_calls values(?,?)',[(now-13*3600,'other')]*7+[(now-13*3600,self.scope)])
        self.db.commit()
        self.assertFalse(engine.reserve(self.db,self.scope,'/player/portal',now))
        self.assertTrue(engine.reserve(self.db,self.scope,'/player/portal',now,controlled=True))
        self.assertFalse(engine.reserve(self.db,self.scope,'/player/portal',now+1,controlled=True))
        self.db.execute('update cf_quota set cooldown=?',(now+engine.DAY,));self.db.commit()
        self.assertFalse(engine.reserve(self.db,'roster','/roster',now,controlled=True))
        self.db.execute('update cf_quota set cooldown=0,remaining=100');self.db.commit()
        self.assertFalse(engine.reserve(self.db,'roster','/roster',now,controlled=True))
        self.db.execute('update cf_quota set remaining=982')
        self.db.executemany('insert into cf_calls values(?,?)',[(now-2*engine.DAY,'older')]*241)
        self.db.commit()
        self.assertFalse(engine.reserve(self.db,'roster','/roster',now,controlled=True))

    def test_controlled_claim_is_durable_single_use_and_requires_12_hours(self):
        now=10_000_000
        self.db.execute('insert into cf_calls values(?,?)',(now-11*3600,self.scope));self.db.commit()
        with self.assertRaises(ValueError): engine.claim_controlled_second(self.db,now)
        engine.claim_controlled_second(self.db,now+3600)
        self.db.close();self.db=sqlite3.connect(self.root/'state.sqlite')
        with self.assertRaises(ValueError): engine.claim_controlled_second(self.db,now+3601)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM cf_controlled_runs').fetchone()[0],1)

    def test_player_batch_reserves_each_http_attempt_and_rejects_partial_budget(self):
        now=10_000_000
        self.db.execute('update cf_quota set sampled=?,remaining=1000',(now,))
        self.db.executemany('insert into cf_calls values(?,?)',[(now,'other')]*6);self.db.commit()
        scopes=['2026/stats/player/season:'+c for c in ('passing','rushing','receiving')]
        self.assertFalse(engine.reserve(self.db,scopes,'/stats/player/season',now))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM cf_calls').fetchone()[0],6)
        self.assertTrue(engine.reserve(self.db,scopes,'/stats/player/season',now,controlled=True))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM cf_calls').fetchone()[0],9)

    def test_player_collection_is_category_scoped_and_does_not_publish_partial_data(self):
        calls=[]
        def fetch(path,params,secret):
            calls.append(params['category'])
            if params['category']=='receiving':raise TimeoutError('private upstream detail')
            return [dict(team='Georgia',season=2026,playerId='9',player='Sample',category=params['category'],statType='YDS',stat='310')]
        with self.assertRaises(TimeoutError):engine.collect_player_season({'year':2026},'local-only',fetch,self.map,2026)
        self.assertEqual(calls,['passing','rushing','receiving'])
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM cf_editions').fetchone()[0],0)

    def test_empty_or_failed_editions_do_not_erase_data(self):
        self.record('Georgia',100)
        self.assertFalse(engine.publish(self.db,self.scope,'/player/portal',{},200,'test'))
        self.assertEqual(100,self.db.execute('select checked from cf_checks').fetchone()[0])

    def test_mirror_is_idempotent_and_stops_on_failure(self):
        self.record('Georgia',100)
        engine.export_team_views(self.db,self.root/'views',2026,2027)
        calls=[]
        mirror.sync(self.db,self.root/'views',calls.append,100)
        mirror.sync(self.db,self.root/'views',calls.append,101)
        self.assertEqual(len(calls),2)
        self.assertTrue(all(c[1].startswith('fd:{cfbd-views-v1}:team:') and c[-2]=='EX' for c in calls))
        def fail(_): raise OSError()
        mirror.sync(self.db,self.root/'views',fail,100+8*engine.DAY)
        self.assertEqual(1,self.db.execute('select count(*) from cf_mirror_attempt').fetchone()[0])

    def test_rankings_and_analytics_keep_missing_values_unknown(self):
        rows=[dict(team='Georgia',season=2026,offense={'successRate':0.5},defense={})]
        data=engine.project('/stats/season/advanced',rows,self.map,2026)
        self.assertEqual(data['61'],[{'offense_successRate':0.5}])
        self.assertFalse(engine.project('/recruiting/players',[{'id':123,'firstName':'Player'}],self.map,2027))

    def test_daily_tick_feeds_the_same_team_view_across_all_datasets(self):
        import runpy
        from unittest.mock import patch
        adapter=runpy.run_path(str(Path(__file__).resolve().parents[1]/'scripts/pulse-cfbd.py'))
        jobs=adapter['datasets'](2026,2027,12,'Tennessee',False)
        responses={'/info':{'remainingCalls':998},'/teams/fbs':[{'school':'Tennessee','mascot':'Volunteers','id':2633},{'school':'Georgia','mascot':'Bulldogs','id':61}],
                   '/player/portal':[{'season':2026,'firstName':'Sample','lastName':'Transfer','origin':'Georgia','destination':'Tennessee'}],
                   '/recruiting/players':[{'id':80,'year':2027,'name':'Sample Prospect','committedTo':'Tennessee','ranking':7,'stars':4}],
                   '/recruiting/teams':[{'team':'Tennessee','year':2027,'rank':5,'points':25.0}],
                   '/roster':[{'id':10,'year':2,'team':'Tennessee','lastName':'Sample','position':'DL'}],
                   '/stats/season/advanced':[{'team':'Tennessee','season':2026,'offense':{'successRate':0.45},'defense':{'successRate':0.41}}],
                   '/stats/season':[{'team':'Georgia','season':2026,'statName':'rushingYards','statValue':1300}],
                   '/stats/player/season':[{'team':'Georgia','season':2026,'playerId':'9','player':'Sample Player','category':'rushing','statType':'YDS','stat':'310'}]}
        calls=[]
        def read(path,params,secret):
            self.assertNotIn('team',params)
            calls.append(path)
            return responses[path]
        with patch.object(engine.time,'time',return_value=10_000_000):
            engine.scheduled(self.db,jobs,'local-only',read)
            engine.scheduled(self.db,jobs,'local-only',read)
        with patch.object(engine.time,'time',return_value=10_000_000+engine.DAY+1):
            engine.scheduled(self.db,jobs,'local-only',read)
        self.assertEqual(calls,list(engine.INTERVAL)[:8]+[
            '/info','/player/portal','/recruiting/players','/stats/season/advanced','/stats/player/season','/stats/player/season','/stats/player/season'])
        engine.export_team_views(self.db,self.root/'views',2026,2027)
        data=json.loads((self.root/'views/2633.json').read_text())['datasets']
        self.assertEqual(set(data),{'transfers','recruits','classRank','roster','analytics'})
        georgia=json.loads((self.root/'views/61.json').read_text())['datasets']
        self.assertEqual(georgia['teamStats']['value']['rushingYards'],1300)
        self.assertEqual(georgia['playerStats']['value']['leaders'][0]['yards'],310)
        self.assertEqual(data['classRank']['value']['rank'],5)
        self.assertEqual(data['recruits']['value']['prospects'][0]['rank'],7)
        self.assertEqual(data['transfers']['value']['incoming']['count'],1)
        self.assertEqual(data['analytics']['value']['defense_successRate'],0.41)
        self.assertFalse({'signings','enrollments'} & data.keys())

if __name__=='__main__': unittest.main()
