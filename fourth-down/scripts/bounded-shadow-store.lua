-- OFFLINE CANDIDATE ONLY. No production transport invokes this script.
-- KEYS: head, index, sizes, byte-counter, payload-hash. All keys are declared.
-- ARGV: expected-head-receipt, semantic-id, receipt-id, compressed-value, now-ms,
--       max-pairs, byte-budget-including-allowance, ttl-seconds.
if #KEYS~=5 then return redis.error_reply('Five declared shadow keys required') end
local names={'head','index','sizes','bytes','payloads'}
for i,name in ipairs(names) do if KEYS[i]~='fd:{shadow}:'..name then return redis.error_reply('Shadow namespace only') end end
local function integer(n,max) return n and n==n and n>=0 and n<=max and n%1==0 end
local expected,semantic,id,value=ARGV[1],ARGV[2],ARGV[3],ARGV[4]
local now,maxPairs,budget,ttl=tonumber(ARGV[5]),tonumber(ARGV[6]),tonumber(ARGV[7]),tonumber(ARGV[8])
if not integer(now,9007199254740000) or not integer(maxPairs,384) or maxPairs<1 or not integer(budget,67108864) or budget<1 or not integer(ttl,3024000) or ttl<60 or #semantic~=64 or string.find(semantic,'[^a-f0-9]') or #id~=64 or string.find(id,'[^a-f0-9]') or #value<1 or #value>65536 then return redis.error_reply('Invalid bounded shadow request') end
local head=redis.call('GET',KEYS[1]);local old={id='',order=0}
if head then local ok,value=pcall(cjson.decode,head);if not ok or type(value)~='table' or type(value.id)~='string' or not integer(tonumber(value.order),9007199254740000) then return {'corrupt',''} end;old=value end
if old.id~=expected then return {'stale',old.id} end
if old.semantic==semantic then return {'unchanged',old.id} end
local ids=redis.call('ZRANGE',KEYS[2],0,-1);local raw=redis.call('HGETALL',KEYS[3]);local sizes={};local bytes=0
for i=1,#raw,2 do local n=tonumber(raw[i+1]);if not integer(n,66048) or n<513 then return {'corrupt',old.id} end;sizes[raw[i]]=n;bytes=bytes+n end
if #raw~=#ids*2 then return {'corrupt',old.id} end
for _,x in ipairs(ids) do if not sizes[x] or sizes[x]<512 then return {'corrupt',old.id} end end
local existing=redis.call('HGET',KEYS[5],id)
local size=#(existing or value)+512
if size>budget then return {'oversized',old.id} end
local kept={};for _,x in ipairs(ids) do if x~=id then table.insert(kept,x) end end
bytes=bytes-(sizes[id] or 0)+size
local evicted={};local cursor=1
while #kept-#evicted+1>maxPairs or bytes>budget do
 local x=kept[cursor];if not x then return {'capacity',old.id} end
 table.insert(evicted,x);bytes=bytes-(sizes[x] or 0);cursor=cursor+1
end
-- All capacity/CAS decisions precede mutations. Batch eviction bounds command count.
redis.call('HSETNX',KEYS[5],id,value)
local order=math.max(now,tonumber(old.order)+1)
redis.call('ZADD',KEYS[2],order,id);redis.call('HSET',KEYS[3],id,size)
if #evicted>0 then
 redis.call('HDEL',KEYS[5],unpack(evicted));redis.call('ZREM',KEYS[2],unpack(evicted));redis.call('HDEL',KEYS[3],unpack(evicted))
end
redis.call('SET',KEYS[4],bytes,'EX',ttl);redis.call('SET',KEYS[1],cjson.encode({id=id,semantic=semantic,previousId=old.id,order=order}),'EX',ttl)
redis.call('EXPIRE',KEYS[2],ttl);redis.call('EXPIRE',KEYS[3],ttl);redis.call('EXPIRE',KEYS[5],ttl)
return {'stored',id,tostring(bytes),tostring(#evicted)}
