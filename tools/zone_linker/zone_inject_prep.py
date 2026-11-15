#!/usr/bin/env python3
"""zone_inject_prep.py <file.ff> <target registry name> <first shard xhash of target> <shard count> <out.json>
Splits the FF into <shard count> slices, names each by xxh64(content), pushes them to the phone shard cache,
and writes the zone_inject.js config. Run with analysis/frida_venv/bin/python3 (needs xxhash)."""
import json, subprocess, sys, xxhash
from pathlib import Path
D='PHONE_IP:5555'; CACHE='/sdcard/Android/data/com.activision.callofduty.warzone/files/shard_cache/xxh64'
src,target,firstx,n,out=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4]),Path(sys.argv[5])
data=Path(src).read_bytes(); per=-(-len(data)//n); tmp=Path(src).with_suffix('.shards'); tmp.mkdir(exist_ok=True)
shards=[]
for i in range(0,len(data),per):
    c=data[i:i+per]; h=xxhash.xxh64(c).hexdigest(); (tmp/h).write_bytes(c); shards.append({'h':h,'n':len(c)})
existing=set(subprocess.run(['adb','-s',D,'shell','ls',CACHE],capture_output=True,text=True).stdout.split())
for s in shards:
    if s['h'] not in existing: subprocess.run(['adb','-s',D,'push',str(tmp/s['h']),f"{CACHE}/{s['h']}"],check=True,capture_output=True)
out.write_text(json.dumps({'file':target,'size':len(data),'firstXhash':firstx,'shards':shards}))
print('shards',len(shards),'size',len(data),'config',out)
