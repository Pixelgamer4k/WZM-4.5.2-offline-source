#!/usr/bin/env python3
"""Sweep the frame-rate-cap dvar enum and measure the real render rate each time.

One Frida attach, six measurements. Read-only counter on the original world-sizing
call (0x2eaf78c), which fires once per rendered frame, so Hz == real fps.
Restores the pre-sweep value at the end.

Usage: fps_sweep.py [indices=0,1,2,3,4,5] [ms=3000]
"""
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
indices = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '0,1,2,3,4,5').split(',')]
window_ms = int(sys.argv[2]) if len(sys.argv) > 2 else 3000

SRC = '''
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const S=0x58,d1=at(0x54bd7b8).readPointer().readPointer();
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const idx={};
for(const dir of [-1,1]){let p=dir>0?d1.add(S):d1;let miss=0;while(miss<400){if(ok(p)){miss=0;idx[p.readU64().toString(16)]=p;}else miss++;p=p.add(dir*S);}}
const CAP='caa98f528ccd5f26';
let frames=0;
try{Interceptor.attach(at(0x2eaf78c),{onEnter(){frames++;}});}catch(e){send({s:'hookFail',e:String(e)});}
rpc.exports={
 cap:function(v){
  const p=idx[CAP]; if(!p) return {ok:false};
  const prior=p.add(0x28).readS32();
  if(v!==null&&v!==undefined){p.add(0x28).writeS32(v);p.add(0x38).writeS32(v);}
  return {ok:true,prior:prior,now:p.add(0x28).readS32()};
 },
 read:function(){return {frames:frames,t:Date.now()};}
};
'''

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
script = session.create_script(SRC)
script.on('message', lambda m, _: print(json.dumps(m.get('payload', m))[:200], flush=True))
script.load()

start = script.exports_sync.cap(None)
print(json.dumps({'s': 'capBeforeSweep', 'value': start.get('prior')}))
rows = []
for v in indices:
    r = script.exports_sync.cap(v)
    time.sleep(1.2)
    a = script.exports_sync.read()
    time.sleep(window_ms / 1000.0)
    b = script.exports_sync.read()
    dt = (b['t'] - a['t']) / 1000.0
    fps = (b['frames'] - a['frames']) / dt if dt else None
    rows.append((v, round(fps, 2) if fps else None, r.get('now')))
    print(json.dumps({'s': 'capTest', 'index': v, 'readback': r.get('now'), 'fps': round(fps, 2) if fps else None}), flush=True)

restore = start.get('prior')
if restore is not None:
    script.exports_sync.cap(restore)
print(json.dumps({'s': 'capRestored', 'value': restore}))
print('index -> measured fps')
for v, fps, rb in rows:
    print(f'  {v}: {fps} fps (readback {rb})')
try:
    script.unload()
    session.detach()
except Exception:
    pass
