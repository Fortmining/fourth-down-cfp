"""Single-host scheduler and private SQLite edition history for the existing CFBD worker."""
import collections
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import time
import unicodedata
from urllib.error import HTTPError

DAY = 86400
TEAM_STATS = {'totalYards', 'rushingYards', 'netPassingYards', 'turnovers', 'interceptions'}
PLAYER_STATS = {('passing','YDS'), ('rushing','YDS'), ('receiving','YDS')}
# All calls are national. A daily account check shares the budget with observation reads.
INTERVAL = {'/info': DAY, '/teams/fbs': 7*DAY, '/player/portal': DAY,
            '/recruiting/players': DAY, '/recruiting/teams': 7*DAY,
            '/roster': 7*DAY, '/stats/season/advanced': DAY,
            '/stats/season': 7*DAY, '/stats/player/season': 7*DAY}
SCHOOLS = Path(__file__).resolve().parents[1] / 'app/data/pulse-teams-2026.json'


def initialize(db):
    db.executescript("""
    CREATE TABLE IF NOT EXISTS cf_calls(at INTEGER NOT NULL, scope TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS cf_calls_time ON cf_calls(at);
    CREATE TABLE IF NOT EXISTS cf_checks(scope TEXT PRIMARY KEY, checked INTEGER NOT NULL, provenance TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cf_quota(slot INTEGER PRIMARY KEY, sampled INTEGER, remaining INTEGER, cooldown INTEGER DEFAULT 0);
    INSERT OR IGNORE INTO cf_quota VALUES(1,0,0,0);
    CREATE TABLE IF NOT EXISTS cf_seen(scope TEXT, team TEXT, observed INTEGER NOT NULL, PRIMARY KEY(scope,team));
    CREATE TABLE IF NOT EXISTS cf_editions(scope TEXT, team TEXT, revision INTEGER, changed INTEGER, digest TEXT,
        facts TEXT NOT NULL, display TEXT NOT NULL, PRIMARY KEY(scope,team,revision));
    CREATE INDEX IF NOT EXISTS cf_team_read ON cf_editions(team,scope,revision DESC);
    """)


def reserve(db, scope, path, now, controlled=False):
    # Count failed/in-flight requests before dispatch. Never reclaim a failed attempt.
    db.execute('BEGIN IMMEDIATE')
    try:
        db.execute('DELETE FROM cf_calls WHERE at < ?', (now-32*DAY,))
        sampled,remaining,cooldown = db.execute('SELECT sampled,remaining,cooldown FROM cf_quota').fetchone()
        recent = lambda cut: db.execute('SELECT COUNT(*) FROM cf_calls WHERE at>=?',(cut,)).fetchone()[0]
        scopes = scope if isinstance(scope,list) else [scope]
        cost = len(scopes)
        if not cost or len(set(scopes)) != cost: raise ValueError('Invalid reservation batch')
        prior = max((db.execute('SELECT MAX(at) FROM cf_calls WHERE scope=?',(item,)).fetchone()[0] or 0 for item in scopes),default=0)
        allowed = cooldown <= now and recent(now-31*DAY)+cost<=250 and recent(now-DAY)+cost<=(16 if controlled else 8)
        interval = 12*3600 if controlled and INTERVAL[path] == DAY else INTERVAL[path]
        if prior is not None and now-prior < interval:
            allowed = False
        if path != '/info' and (sampled < now-30*3600 or remaining-recent(sampled)-cost<100):
            allowed = False
        if allowed:
            db.executemany('INSERT INTO cf_calls VALUES(?,?)',[(now,item) for item in scopes])
        db.commit()
        return allowed
    except BaseException:
        db.rollback()
        raise


def clean(s):
    return ' '.join(''.join(c if c.isalnum() else ' ' for c in unicodedata.normalize('NFKD',s).casefold()).split())


def program_map(rows):
    inventory=json.loads(SCHOOLS.read_text())['teams']
    schools={clean(team['name']):team['id'] for team in inventory}
    aliases=collections.defaultdict(set)
    for row in rows:
        name=row.get('school')
        if not name or not row.get('mascot'): continue
        team=schools.get(clean(name+' '+row['mascot']))
        # Cross-check the ID and school name when the two publishers style mascots differently.
        if not team:
            team=next((t['id'] for t in inventory if t['id']==str(row.get('id')) and
                       clean(t['name']).startswith(clean(name)+' ')),None)
        if team: aliases[clean(name)].add(team)
    return {key:next(iter(ids)) for key,ids in aliases.items() if len(ids)==1}


def text_field(value):
    return value.strip()[:160] if isinstance(value,str) else ''


def number(value):
    return value if type(value) in (float,int) and math.isfinite(value) else None


def project(path, rows, mapping, year):
    """Normalize provider observations. No article, player bio, health or portal-event inference."""
    teams=collections.defaultdict(list)
    for r in rows:
        if not isinstance(r,dict): continue
        if path!='/roster' and r.get('season',r.get('year',year))!=year: continue
        school=text_field(r.get('team'))
        if path=='/player/portal':
            name=' '.join(filter(None,(text_field(r.get('firstName')),text_field(r.get('lastName')))))
            origin,dest=(text_field(r.get(k)) for k in ('origin','destination'))
            if not name or not origin: continue
            for label,who in [('outgoing',origin),('incoming',dest)]:
                if clean(who) in mapping:
                    teams[mapping[clean(who)]].append(dict(name=name,position=text_field(r.get('position')),direction=label,
                        origin=origin,destination=dest,date=text_field(r.get('transferDate'))))
            continue
        if path=='/recruiting/players': school=text_field(r.get('committedTo'))
        team=mapping.get(clean(school))
        if not team: continue
        if path=='/stats/season' and r.get('statName') in TEAM_STATS:
            metric,value=r['statName'],number(r.get('statValue'))
            if value is None: continue
            fact=dict(metric=metric,value=value)
        elif path=='/stats/player/season' and (r.get('category'),r.get('statType')) in PLAYER_STATS:
            player=text_field(r.get('player'))
            try: yards=int(r.get('stat'))
            except (ValueError,TypeError): continue
            if not player or not r.get('playerId'): continue
            fact=dict(id=str(r['playerId']),name=player,category=r['category'],yards=yards)
        elif path=='/roster' and r.get('id') and r.get('lastName'):
            fact=dict(id=str(r['id']),position=text_field(r.get('position')) or 'Unlisted')
        elif path=='/recruiting/players' and r.get('id') and r.get('name'):
            fact=dict(id=str(r['id']),name=text_field(r['name']),position=text_field(r.get('position')),
                      stars=number(r.get('stars')),rank=number(r.get('ranking')))
        elif path=='/recruiting/teams' and number(r.get('rank')) is not None:
            fact=dict(rank=r['rank'],points=number(r.get('points')))
        elif path=='/stats/season/advanced':
            fact={}
            for side in ('offense','defense'):
                stats=r.get(side) or {}
                for field in ('successRate','ppa'):
                    value=number(stats.get(field))
                    if value is not None: fact[side+'_'+field]=value
            if not fact: continue
        else: continue
        teams[team].append(fact)
    return teams


def pack(path, rows):
    rows=sorted({json.dumps(r,sort_keys=True,separators=(',',':')) for r in rows})
    facts='['+','.join(rows)+']'
    values=list(map(json.loads,rows))
    if path in ('/roster','/recruiting/players') and len({r['id'] for r in values})!=len(values):
        raise ValueError('Conflicting provider player identities')
    if path in ('/stats/season/advanced','/recruiting/teams') and len(values)>1:
        raise ValueError('Conflicting provider team observations')
    if path=='/stats/season':
        display={r['metric']:r['value'] for r in values}
        if len(display)!=len(values): raise ValueError('Conflicting team statistics')
    elif path=='/stats/player/season':
        if len({(r['id'],r['category']) for r in values})!=len(values):
            raise ValueError('Conflicting player statistics')
        display={'leaders':[]}
        for category in ('passing','rushing','receiving'):
            leaders=sorted((r for r in values if r['category']==category),key=lambda r:(-r['yards'],r['id']))
            display['leaders'].extend(leaders[:3])
    elif path=='/player/portal':
        values.sort(key=lambda r:(r['date'],r['name']),reverse=True)
        display={d:{'count':sum(r['direction']==d for r in values),
                    'positions':dict(collections.Counter(r['position'] or 'Unlisted' for r in values if r['direction']==d)),
                    'examples':[r for r in values if r['direction']==d][:12]} for d in ('incoming','outgoing')}
    elif path=='/roster':
        display={'listed':len(values),'positions':dict(collections.Counter(r['position'] for r in values))}
    elif path=='/recruiting/players':
        values.sort(key=lambda r:(r['rank'] if r['rank'] and r['rank']>0 else 100000,r['name'],r['id']))
        display={'reported':len(values),'prospects':values[:5]}
    else:
        display=values[0] if len(values)==1 else {}
    return facts,json.dumps(display,sort_keys=True,separators=(',',':'))


def publish(db, scope, path, teams, now, provenance):
    if not teams: return False  # empty national response cannot retract an entire edition
    with db:
        db.execute('BEGIN IMMEDIATE')
        prior=db.execute('SELECT checked FROM cf_checks WHERE scope=?',(scope,)).fetchone()
        if prior and prior[0]>=now: return False
        previous=dict(db.execute('SELECT team,MAX(revision) FROM cf_editions WHERE scope=? GROUP BY team',(scope,)))
        for team in sorted(teams):
            db.execute('INSERT OR REPLACE INTO cf_seen VALUES(?,?,?)',(scope,team,now))
            facts,display=pack(path,teams.get(team,[]))
            digest=hashlib.sha256(facts.encode()).hexdigest()
            rev=previous.get(team,0)
            if db.execute('SELECT 1 FROM cf_editions WHERE scope=? AND team=? AND revision=? AND digest=?',
                          (scope,team,rev,digest)).fetchone(): continue
            db.execute('INSERT INTO cf_editions VALUES(?,?,?,?,?,?,?)',(scope,team,rev+1,now,digest,facts,display))
            db.execute('DELETE FROM cf_editions WHERE scope=? AND team=? AND revision<=?',(scope,team,rev-3))
        db.execute('INSERT OR REPLACE INTO cf_checks VALUES(?,?,?)',(scope,now,provenance))
    return True


def collect_player_season(params,secret,fetch,mapping,year):
    """Publish only after all three bounded category requests succeed."""
    teams=collections.defaultdict(list)
    for category in ('passing','rushing','receiving'):
        rows=fetch('/stats/player/season',{**params,'category':category},secret)
        if not isinstance(rows,list) or not rows:
            raise ValueError('Player category unavailable')
        projected=project('/stats/player/season',rows,mapping,year)
        if not projected: raise ValueError('No matched player category data')
        for team,facts in projected.items(): teams[team].extend(facts)
    return teams


def scheduled(db, jobs, secret, fetch, controlled=False):
    initialize(db)
    db.execute('CREATE TABLE IF NOT EXISTS cf_identity(season INTEGER PRIMARY KEY, mapping TEXT NOT NULL)')
    season=jobs['/teams/fbs']['year']
    for path in INTERVAL:
        params=jobs[path]; year=params.get('year',season)
        scope=f'{year}{path}' if path!='/info' else '/info'
        identity=db.execute('SELECT mapping FROM cf_identity WHERE season=?',(season,)).fetchone()
        if path not in ('/teams/fbs','/info') and not identity: continue
        now=int(time.time())
        reservation = [scope+':'+category for category in ('passing','rushing','receiving')] if path=='/stats/player/season' else scope
        if not reserve(db,reservation,path,now,controlled=controlled): continue
        try:
            if path=='/stats/player/season':
                teams = collect_player_season(params,secret,fetch,json.loads(identity[0]),year)
                publish(db,scope,path,teams,now,'CollegeFootballData API')
                print(path,'checked (three bounded category requests)')
                continue
            rows=fetch(path,params,secret)
            if path=='/info':
                remaining=rows.get('remainingCalls')
                with db: db.execute('UPDATE cf_quota SET sampled=?,remaining=? WHERE slot=1',
                    (now,remaining if type(remaining) is int and remaining>=0 else 0))
            elif path=='/teams/fbs':
                matched=program_map(rows)
                if not matched: continue
                with db: db.execute('INSERT OR REPLACE INTO cf_identity VALUES(?,?)',(season,json.dumps(matched)))
            else:
                teams=project(path,rows,json.loads(identity[0]),year)
                publish(db,scope,path,teams,now,'CollegeFootballData API')
            print(path,'checked')
        except HTTPError as error:
            print(path,'HTTP',error.code)
            error.close()
            if path=='/info' or error.code in (401,403,429):
                delay=error.headers.get('Retry-After','') if error.headers else ''
                seconds=int(delay) if delay.isdecimal() and len(delay)<10 else 0
                with db: db.execute('UPDATE cf_quota SET cooldown=? WHERE slot=1',(now+max(DAY,seconds),))
                break
        except (OSError,ValueError) as error:
            print(path, 'unavailable ('+type(error).__name__+'); previous edition retained')
            if path=='/info': break


def claim_controlled_second(db, now):
    """Claim once while holding the worker file lock; retain the audit on failure."""
    initialize(db)
    db.execute('CREATE TABLE IF NOT EXISTS cf_controlled_runs(id TEXT PRIMARY KEY, started INTEGER NOT NULL)')
    db.execute('BEGIN IMMEDIATE')
    try:
        last = db.execute('SELECT MAX(at) FROM cf_calls').fetchone()[0]
        count = db.execute('SELECT COUNT(*) FROM cf_calls WHERE at>=?', (now-31*DAY,)).fetchone()[0]
        cooldown = db.execute('SELECT cooldown FROM cf_quota WHERE slot=1').fetchone()[0]
        if last is None or not 12*3600 <= now-last < DAY or count > 8 or cooldown > now:
            raise ValueError('Controlled second run requires the original first-run ledger, 12–24 hours elapsed and no provider cooldown')
        if db.execute('SELECT 1 FROM cf_controlled_runs WHERE id=?', ('second-v1',)).fetchone():
            raise ValueError('Controlled second-run exception already consumed; review before retrying')
        db.execute('INSERT INTO cf_controlled_runs VALUES(?,?)', ('second-v1',now))
        db.commit()
    except BaseException:
        db.rollback()
        raise


def run_on_volume(filename,jobs,secret,fetch,controlled=False):
    import tempfile
    path=Path(filename).expanduser()
    if os.environ.get('VERCEL') or not path.is_absolute() or path.resolve().is_relative_to(Path(tempfile.gettempdir()).resolve()) or any(path.resolve().is_relative_to(p.resolve()) for p in (Path('/tmp'), Path('/var/tmp'), SCHOOLS.parents[2])):
        raise SystemExit('Scheduled SQLite requires an absolute private path on a persistent worker volume.')
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    with open(str(path)+'.lock','a') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: return
        with sqlite3.connect(path, timeout=10) as db:
            db.execute('PRAGMA journal_mode=WAL')
            if controlled:
                claim_controlled_second(db, int(time.time()))
            scheduled(db,jobs,secret,fetch,controlled=controlled)
            export_team_views(db, path.parent/'views', jobs['/teams/fbs']['year'], jobs['/recruiting/players']['year'])
            if os.environ.get('PULSE_CFBD_PUBLISH')=='approved-v1':
                from pulse_cfbd_mirror import sync
                sync(db,path.parent/'views')


def export_team_views(db,directory,season,class_year):
    directory.mkdir(mode=0o700,parents=True,exist_ok=True)
    editions=collections.defaultdict(dict)
    labels={'/roster':'roster','/player/portal':'transfers','/recruiting/players':'recruits',
            '/recruiting/teams':'classRank','/stats/season/advanced':'analytics',
            '/stats/season':'teamStats','/stats/player/season':'playerStats'}
    for path,label in labels.items():
        year=class_year if path.startswith('/recruiting') else season
        scope=f'{year}{path}'
        rows=db.execute("""SELECT e.team,e.revision,e.display,s.observed,c.provenance,c.checked FROM cf_editions e
          JOIN cf_checks c USING(scope) JOIN cf_seen s ON s.team=e.team AND s.scope=e.scope WHERE e.scope=? AND e.revision=(
          SELECT MAX(h.revision) FROM cf_editions h WHERE h.team=e.team AND h.scope=e.scope)""",(scope,))
        for team,revision,display,checked,source,latest in rows:
            editions[team][label]={'year':year,'revision':revision,'observedAt':checked,'source':source,
                                   'inLatest':checked==latest,'value':json.loads(display)}
    allowed={str(t['id']) for t in json.loads(SCHOOLS.read_text())['teams']}
    for team in allowed:
        file=directory/(team+'.json')
        if team not in editions:
            file.unlink(missing_ok=True)
            continue
        data=json.dumps({'version':1,'team':team,'datasets':editions[team]},sort_keys=True,separators=(',',':'))
        if len(data.encode())>24576: raise ValueError('team display limit')
        if file.exists() and file.read_text()==data: continue
        pending=file.with_suffix('.pending')
        pending.write_text(data);pending.replace(file)
