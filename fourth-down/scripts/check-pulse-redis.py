"""Offline Lua semantics only; never connects to a hosted Redis or reads credentials.
Run with a disposable local Python environment containing fakeredis[lua].
"""
from pathlib import Path
import re,json,base64,concurrent.futures
import fakeredis
source=Path(__file__).resolve().parents[1]/'app/lib/pulse-story-redis.ts'
script=re.search(r'export const pulseArchiveScript=`([\s\S]*?)`;',source.read_text()).group(1)
keys=['fd:{pulse-stories-v1}:archive','fd:{pulse-stories-v1}:meter']
r=fakeredis.FakeRedis(decode_responses=True)
def run(mode,expected='',value='',units=0,quota=0,day='2026-10-31',use_keys=keys):return r.eval(script,2,*use_keys,mode,expected,value,day,units,quota)
def expect_error(fn):
 try:fn()
 except Exception:return
 raise AssertionError('Expected rejection')
expect_error(lambda:run('read',use_keys=['fd:v05:subscriptions',keys[1]]))
assert not r.exists(keys[0])
empty='v0'
assert run('read')==['read','',empty]
payload=base64.b64encode(b'{"test":"offline"}').decode()
a=json.dumps({'version':1,'generation':1,'checkedAt':'2026-10-31T12:00:00Z','payload':payload})
assert run('commit',empty,a)==['saved']
assert 0<r.ttl(keys[0])<=15552000
assert run('commit',empty,a)==['conflict']
etag='v1'
assert run('commit',etag,a)==['conflict'] # stale generation, even with latest etag
b=json.dumps({'version':1,'generation':2,'checkedAt':'2026-10-31T12:01:00Z','payload':payload})
assert run('commit',etag,b)==['saved']
assert run('read')[1:]==[payload,'v2']
# One shared atomic counter across concurrent callers, with no refund after failures.
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:result=list(pool.map(lambda _:run('quota',units=2,quota=10),range(12)))
assert result.count(['reserved'])==5
assert json.loads(r.get(keys[1]))['youtube']==10
assert run('quota',units=1,quota=10)==['limited']
assert run('quota',units=1,quota=10,day='2026-10-30')==['limited']
assert run('quota',units=1,quota=10,day='2026-11-01')==['reserved']
# Resource exhaustion withholds writes, preserving the latest archive.
meter=json.loads(r.get(keys[1]));meter['writes']=600;r.set(keys[1],json.dumps(meter))
assert run('commit','v2',b,day='2026-11-01')==['limited']
assert r.get(keys[0])==b
print(json.dumps({'mode':'offline fakeredis/Lua simulation','checks':['key isolation','atomic CAS','generation rollback rejection','180-day TTL','concurrent quota reservation','no refund after failure','UTC rollover','write-limit fail closed'],'passed':True}))
