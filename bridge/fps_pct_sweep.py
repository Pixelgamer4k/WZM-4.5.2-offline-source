#!/usr/bin/env python3
"""Live test: is the 30 fps a cap or a GPU wall at the current render scale?

Writes the render-resolution percentage dvar to several values and measures the
real render rate (read-only counter on the once-per-frame world sizing call
0x2eaf78c) at each. If fps climbs as the percentage drops, the frame is GPU/scale
bound and no frame-cap index will ever give you 60. If fps stays flat, it is a cap.

Usage: fps_pct_sweep.py [pcts=75,60,50,40] [ms=3000]
"""
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
pcts = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else '75,60,50,40').split(',')]
window_ms = int(sys.argv[2]) if len(sys.argv) > 2 else 3000

SRC = '''
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const S=0x58,d1=at(0x54bd7b8).readPointer().readPointer();
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const idx={};
for(const dir of [-1,1]){let p=dir>0?d1.add(S):d1;let miss=0;while(miss<400){if(ok(p)){miss=0;idx[p.readU64().toString(16)]=p;}else miss++;p=p.add(dir*S);}}
const PCTS=['270baabe0eb3399e','ba9243ff7e168cf'];
let frames=0,gpu=0;
try{Interceptor.attach(at(0x2eaf78c),{onEnter(){frames++;}});}catch(e){send({s:'hookFail',e:String(e)});}
rpc.exports={
 pct:function(v){
  const out={};
  for(const h of PCTS){const p=idx[h];if(!p){out[h]='missing';continue;}
   if(v!==null&&v!==undefined){p.add(0x28).writeS32(v);p.add(0x38).writeS32(v);}
   out[h]=p.add(0x28).readS32();}
  return out;
 },
 read:function(){return {frames:frames,t:Date.now()};}
};
'''

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
script = session.create_script(SRC)
script.load()
before = script.exports_sync.pct(None)
print(json.dumps({'s': 'pctBefore', 'values': before}), flush=True)
rows = []
for v in pcts:
    script.exports_sync.pct(v)
    time.sleep(1.5)
    a = script.exports_sync.read()
    time.sleep(window_ms / 1000.0)
    b = script.exports_sync.read()
    dt = (b['t'] - a['t']) / 1000.0
    fps = (b['frames'] - a['frames']) / dt if dt else None
    rows.append((v, round(fps, 2) if fps else None))
    print(json.dumps({'s': 'pctTest', 'pct': v, 'fps': round(fps, 2) if fps else None}), flush=True)
orig = next((v for v in before.values() if isinstance(v, int)), None)
if orig is not None:
    script.exports_sync.pct(orig)
print(json.dumps({'s': 'pctRestored', 'value': orig}))
print('render pct -> measured fps')
for v, fps in rows:
    print(f'  {v:>3}%: {fps} fps')
try:
    script.unload()
    session.detach()
except Exception:
    pass
