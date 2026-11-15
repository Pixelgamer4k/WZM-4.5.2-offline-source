#!/usr/bin/env python3
"""Measure the live server-frame rate (tick Hz) and a render-size call rate.

Usage: tick_probe.py [seconds=10]

Read-only: one Interceptor counter on the original server frame 0x3cf10e0 and on
the world sizing call 0x2eaf78c. Reports Hz for the window. Safe to run alongside
the host session; adds two counters and two sends only.
"""
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
secs = float(sys.argv[1]) if len(sys.argv) > 1 else 10.0

SRC = '''
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
let sv=0,size=0;
try{Interceptor.attach(at(0x3cf10e0),{onEnter(){sv++;}});}catch(e){send({s:'hookFail',w:'sv',e:String(e)});}
try{Interceptor.attach(at(0x2eaf78c),{onEnter(){size++;}});}catch(e){send({s:'hookFail',w:'size',e:String(e)});}
send({s:'countersArmed'});
rpc.exports={read(){return {sv,size,t:Date.now()};}};
'''

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
script = session.create_script(SRC)
script.on('message', lambda m, _: print(json.dumps(m.get('payload', m))[:300], flush=True))
script.load()
a = script.exports_sync.read()
time.sleep(secs)
b2 = script.exports_sync.read()
dt = (b2['t'] - a['t']) / 1000.0
print(json.dumps({'s': 'tickRate', 'seconds': round(dt, 2),
                  'serverFrameHz': round((b2['sv'] - a['sv']) / dt, 2) if dt else None,
                  'sizeCallHz': round((b2['size'] - a['size']) / dt, 2) if dt else None,
                  'serverFrames': b2['sv'] - a['sv'], 'sizeCalls': b2['size'] - a['size']}))
try:
    script.unload()
    session.detach()
except Exception:
    pass
