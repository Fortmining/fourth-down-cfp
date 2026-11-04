"""Execute the offline retention candidate on private-socket local Redis only."""
import json,pathlib,socket,subprocess,sys,tempfile,time,hashlib
binary,pairs_file,lua_file,output=sys.argv[1:];pairs=json.loads(pathlib.Path(pairs_file).read_text());lua=pathlib.Path(lua_file).read_text()
class Redis:
 def __init__(self,endpoint):
  self.socket=socket.socket(socket.AF_UNIX);self.socket.connect(endpoint);self.file=self.socket.makefile('rb')
 def read(self):
  line=self.file.readline();tag,val=line[:1],line[1:-2]
  if tag==b'-':raise RuntimeError(val.decode())
  if tag==b':':return int(val)
  if tag==b'$':
   n=int(val)
   if n<0:return None
   d=self.file.read(n);self.file.read(2);return d
  if tag==b'*':return [self.read() for _ in range(int(val))]
  return val
 def cmd(self,*args):
  parts=[a if isinstance(a,bytes) else str(a).encode() for a in args];self.socket.sendall(b'*'+str(len(parts)).encode()+b'\r\n'+b''.join(b'$'+str(len(a)).encode()+b'\r\n'+a+b'\r\n' for a in parts));return self.read()
with tempfile.TemporaryDirectory(prefix='fourth-bounded-redis-') as root:
 endpoint=str(pathlib.Path(root)/'r.sock')
 with open(pathlib.Path(root)/'server.log','w') as log:
  process=subprocess.Popen([binary,'--port','0','--unixsocket',endpoint,'--unixsocketperm','700','--save','','--appendonly','no','--maxmemory','64mb','--maxmemory-policy','noeviction','--dir',root],stdout=log,stderr=log)
  try:
   for _ in range(200):
    if pathlib.Path(endpoint).exists():break
    if process.poll() is not None:raise RuntimeError('Local Redis failed')
    time.sleep(.05)
   r=Redis(endpoint);keys=['fd:{shadow}:head','fd:{shadow}:index','fd:{shadow}:sizes','fd:{shadow}:bytes','fd:{shadow}:payloads'];head='';payload=max(pairs,key=lambda x:len(x['encoded']))['encoded'];start=time.perf_counter();writes=1000;max_count=384;budget=16*1024*1024
   for i in range(writes):
    semantic=hashlib.sha256(('synthetic-state-'+str(i)).encode()).hexdigest();receipt=hashlib.sha256(('synthetic-receipt-'+str(i)).encode()).hexdigest()
    reply=r.cmd('EVAL',lua,5,*keys,head,semantic,receipt,payload,100000+i,max_count,budget,3024000);assert reply[0]==b'stored',reply;head=receipt
   ids=r.cmd('ZRANGE',keys[1],0,-1);assert len(ids)==384;assert r.cmd('HLEN',keys[4])==384;assert int(r.cmd('GET',keys[3]))<=budget
   head_value=r.cmd('GET',keys[0]);h=json.loads(head_value);assert h['previousId']!=h['id']
   stale=r.cmd('EVAL',lua,5,*keys,'stale',semantic,receipt,payload,200000,384,budget,3024000);assert stale[0]==b'stale';assert r.cmd('GET',keys[0])==head_value
   before_noops=r.cmd('INFO','commandstats').decode()
   for i in range(360):
    # Real proposed integration checks the head first; it skips EVAL on unchanged identity.
    current=json.loads(r.cmd('GET',keys[0]));assert current['semantic']==semantic
   after_noops=r.cmd('INFO','commandstats').decode()
   total=sum(r.cmd('MEMORY','USAGE',key,'SAMPLES',0) for key in r.cmd('KEYS','fd:{shadow}:*'));commandstats=r.cmd('INFO','commandstats').decode()
   # Same semantic state with another request receipt remains a true no-op.
   unchanged=r.cmd('EVAL',lua,5,*keys,head,semantic,'b'*64,payload,200001,384,budget,3024000);assert unchanged[0]==b'unchanged';assert r.cmd('GET',keys[0])==head_value
   # Returning to an earlier semantic state is a new, ordered evidence receipt.
   revisit=hashlib.sha256(('synthetic-state-'+str(writes-2)).encode()).hexdigest();new_receipt=hashlib.sha256(b'returned-state-new-receipt').hexdigest()
   returned=r.cmd('EVAL',lua,5,*keys,head,revisit,new_receipt,payload,200002,384,budget,3024000);assert returned[0]==b'stored';assert json.loads(r.cmd('GET',keys[0]))['previousId']==head;head=new_receipt
   assert r.cmd('HLEN',keys[4])==384
   # Byte cap can evict in batches even if count cap would allow more.
   tiny=r.cmd('EVAL',lua,5,*keys,head,'c'*64,'d'*64,payload,200002,384,len(payload)+512,3024000);assert tiny[0]==b'stored';assert len(r.cmd('ZRANGE',keys[1],0,-1))==1;assert r.cmd('HLEN',keys[4])==1
   # Invalid numeric input and another namespace must fail before mutation.
   safe_head=r.cmd('GET',keys[0]);safe_count=r.cmd('HLEN',keys[4])
   for invalid_keys,invalid_now in [(keys,'nan'),(['notifications:head',*keys[1:]],200003)]:
    rejected=False
    try:r.cmd('EVAL',lua,5,*invalid_keys,head,'e'*64,'f'*64,payload,invalid_now,384,budget,3024000)
    except RuntimeError:rejected=True
    assert rejected;assert r.cmd('GET',keys[0])==safe_head;assert r.cmd('HLEN',keys[4])==safe_count
   def calls(info):return {line.split(':',1)[0]:int(line.split('calls=')[1].split(',')[0]) for line in info.splitlines() if 'calls=' in line}
   a,b=calls(before_noops),calls(after_noops);delta={k:b.get(k,0)-a.get(k,0) for k in set(a)|set(b) if b.get(k,0)!=a.get(k,0)}
   result={'localOnly':True,'syntheticRetentionWrites':writes,'largestCapturedValueBytes':len(payload),'retainedPairs':384,'retainedTotalKeyMemoryBytes':total,'logicalByteBudget':budget,'boundedPayloadCount':True,'staleCASPreservedHead':True,'sameSemanticNewReceiptDidNotWrite':True,'batchByteEvictionPassed':True,'returnedStatePreservesNewReceipt':True,'malformedAndForeignNamespaceRejected':True,'unchanged360ChecksCommandDelta':delta,'commandStatsIncludingInstrumentation':commandstats,'wallSeconds':time.perf_counter()-start,'productionWrites':0,'productionTransportInstalled':False,'extraSchedules':0,'hostedBillingValidated':False}
   pathlib.Path(output).write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='commandStatsIncludingInstrumentation'}))
  finally:
   process.terminate()
   try:process.wait(timeout=10)
   except subprocess.TimeoutExpired:process.kill();process.wait()
