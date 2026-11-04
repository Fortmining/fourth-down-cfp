"""Offline Redis protocol/allocator experiment. Never reads production credentials.
Usage: python3 scripts/profile-local-redis.py /absolute/redis-server pairs.json report.json
The process listens on a private Unix socket only and is terminated afterward.
"""
import sys,socket,subprocess,tempfile,pathlib,json,time,hashlib
binary,pairs_path,output=sys.argv[1:]
pairs=json.loads(pathlib.Path(pairs_path).read_text())
if not pairs:raise ValueError('No captured payload pairs')
with tempfile.TemporaryDirectory(prefix='fourth-local-redis-') as directory:
 endpoint=str(pathlib.Path(directory)/'redis.sock')
 with open(pathlib.Path(directory)/'server.log','w') as log:
  process=subprocess.Popen([binary,'--port','0','--unixsocket',endpoint,'--unixsocketperm','700','--save','','--appendonly','no','--maxmemory','64mb','--maxmemory-policy','noeviction','--dir',directory],stdout=log,stderr=log)
  try:
   for _ in range(200):
    if pathlib.Path(endpoint).exists():break
    if process.poll() is not None:raise RuntimeError('Local server failed')
    time.sleep(.05)
   sock=socket.socket(socket.AF_UNIX);sock.connect(endpoint);file=sock.makefile('rb');counts={}
   def read():
    line=file.readline();kind=line[:1];value=line[1:-2]
    if kind==b'-':raise RuntimeError(value.decode())
    if kind==b':':return int(value)
    if kind==b'$':
     size=int(value)
     if size<0:return None
     data=file.read(size);file.read(2);return data
    if kind==b'*':return [read() for _ in range(int(value))]
    return value
   def command(*args):
    parts=[str(a).encode() if not isinstance(a,bytes) else a for a in args];sock.sendall(b'*'+str(len(parts)).encode()+b'\r\n'+b''.join(b'$'+str(len(p)).encode()+b'\r\n'+p+b'\r\n' for p in parts));counts[args[0]]=counts.get(args[0],0)+1;return read()
   def memory():return sum(command('MEMORY','USAGE',key) or 0 for key in command('KEYS','fd:shadow:*'))
   script="if (redis.call('GET',KEYS[1]) or '') ~= ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[2]);return 1"
   initial=command('INFO','commandstats').decode();head='';start=time.perf_counter()
   for pair in pairs:
    old=command('GET','fd:shadow:head');assert (old.decode() if old else '')==head
    assert command('SET','fd:shadow:pair:'+pair['id'],pair['encoded'],'NX','EX',604800)==b'OK'
    command('ZADD','fd:shadow:index',time.time(),pair['id'])
    assert command('EVAL',script,1,'fd:shadow:head',head,pair['id'])==1;head=pair['id']
   memory_after_unique=memory();before_noops=dict(counts)
   for _ in range(360):assert command('GET','fd:shadow:head').decode()==head
   noop_commands={k:counts[k]-before_noops.get(k,0) for k in counts if counts[k]!=before_noops.get(k,0)}
   assert command('EVAL',script,1,'fd:shadow:head','stale-head','wrong')==0
   assert command('GET','fd:shadow:head').decode()==head
   # Synthetic allocator load only: same largest real payload under distinct test keys.
   biggest=max(pairs,key=lambda p:len(p['encoded']))
   for i in range(384):command('SET','fd:shadow:stress:'+str(i),biggest['encoded'],'EX',604800)
   all_memory=memory();stats=command('INFO','commandstats').decode()
   report={'measurement':'Local Redis 7.2.17 private Unix-socket experiment; not Upstash billing or production Vercel execution','capturedPairs':len(pairs),'payloadSHA256':hashlib.sha256(pathlib.Path(pairs_path).read_bytes()).hexdigest(),'keyMemoryAfterUniqueBytes':memory_after_unique,'synthetic384PairIncrementBytes':all_memory-memory_after_unique,'allExperimentKeyMemoryBytes':all_memory,'unchanged360Checks':noop_commands,'staleCASRejected':True,'wallSeconds':time.perf_counter()-start,'clientCommandCountsIncludingInstrumentation':counts,'commandStats':stats,'productionWrites':0,'productionCredentialsRead':False,'extraQstashDeliveries':0,'limitation':'Local allocator and Redis subcommand statistics do not establish Upstash command billing, REST latency, retries, replication or Vercel CPU cost.'}
   pathlib.Path(output).write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ['commandStats','clientCommandCountsIncludingInstrumentation']}));sock.close()
  finally:
   process.terminate()
   try:process.wait(timeout=10)
   except subprocess.TimeoutExpired:process.kill();process.wait()
