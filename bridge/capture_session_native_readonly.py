#!/usr/bin/env python3
"""Attach read-only; observe the original host session globals and callbacks."""
import json
import pathlib
import subprocess
import sys
import time

import frida

ROOT=pathlib.Path(__file__).resolve().parents[3]
SCRIPT=pathlib.Path(__file__).with_name('session_native_observer.js')
if len(sys.argv) != 2:
    raise SystemExit('usage: capture_session_native_readonly.py <UNIQUE_OUT.json>')
OUT=pathlib.Path(sys.argv[1])
if OUT.exists():
    raise SystemExit('refusing existing output file')
pid=int(subprocess.check_output(['adb','-s','PHONE_IP:5555',
    'shell','pidof','com.activision.callofduty.warzone']).decode().strip())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
events=[]
sc=s.create_script(SCRIPT.read_text())
sc.on('message',lambda m,_:events.append(m.get('payload',m)))
sc.load()
try:
    samples=[sc.exports_sync.sample()]
    time.sleep(3)
    samples.append(sc.exports_sync.sample())
finally:
    sc.unload()
    s.detach()
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps({'pid':pid,'samples':samples,'events':events},indent=2))
print(json.dumps({'pid':pid,'samples':samples,'events':len(events),'output':str(OUT)}))
