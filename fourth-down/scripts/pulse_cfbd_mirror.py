"""Optional bounded mirror of derived team views, enabled only after a Redis health gate."""
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,build_opener,HTTPRedirectHandler

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args): return None


def send(command):
    url=os.environ['PULSE_CFBD_REDIS_URL'];parts=urlsplit(url)
    if parts.scheme!='https' or not parts.hostname or not parts.hostname.endswith('.upstash.io') or parts.username or parts.password or parts.port or parts.path not in ('','/') or parts.query or parts.fragment:
        raise ValueError('Invalid mirror endpoint')
    for key in ('UPSTASH_REDIS_REST_URL','KV_REST_API_URL'):
        if urlsplit(os.environ.get(key,'')).hostname==parts.hostname:
            raise ValueError('Mirror must use a separate Redis database')
    req=Request(url,data=json.dumps(command).encode(),headers={'Authorization':'Bearer '+os.environ['PULSE_CFBD_REDIS_TOKEN'],'Content-Type':'application/json'})
    with build_opener(NoRedirect()).open(req,timeout=5) as res:
        if json.loads(res.read(2048)).get('result')!='OK': raise ValueError('Mirror write rejected')


def sync(db,directory,write=send,now=None):
    now=int(time.time()) if now is None else now
    db.executescript("""
    CREATE TABLE IF NOT EXISTS cf_mirror(team TEXT PRIMARY KEY,digest TEXT,updated INTEGER);
    CREATE TABLE IF NOT EXISTS cf_mirror_attempt(at INTEGER);
    """)
    with db: db.execute('DELETE FROM cf_mirror_attempt WHERE at<?',(now-86400,))
    budget=min(24,144-db.execute('SELECT COUNT(*) FROM cf_mirror_attempt').fetchone()[0])
    if budget<=0: return
    last={team:(digest,stamp) for team,digest,stamp in db.execute('SELECT * FROM cf_mirror')}
    for f in sorted(Path(directory).glob('*.json'),key=lambda f:last.get(f.stem,('',0))[1]):
        if not f.stem.isdigit(): continue
        data=f.read_bytes()
        if len(data)>24576: continue
        digest=hashlib.sha256(data).hexdigest()
        prev,stamp=last.get(f.stem,('',0))
        if prev==digest and stamp>now-7*86400: continue
        with db: db.execute('INSERT INTO cf_mirror_attempt VALUES(?)',(now,))
        try: write(['SET','fd:{cfbd-views-v1}:team:'+f.stem,data.decode(),'EX',14*86400])
        except (OSError,ValueError,KeyError):
            print('CFBD display mirror unavailable; SQLite edition retained')
            break
        with db: db.execute('INSERT OR REPLACE INTO cf_mirror VALUES(?,?,?)',(f.stem,digest,now))
        budget-=1
        if budget<=0: break
