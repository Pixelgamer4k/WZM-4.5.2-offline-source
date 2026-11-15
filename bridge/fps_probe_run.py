#!/usr/bin/env python3
"""Read (and optionally write) the live frame-rate-cap dvar.

Usage: fps_probe_run.py [index|-] [seconds=12]

Prints the dvar registry values reported by fps_cap_probe.js. With an index it
also writes that index to the cap dvar and re-reads it, so the enum mapping
(which index is really 60) can be measured from the on-screen FPS counter.
"""
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
idx = sys.argv[1] if len(sys.argv) > 1 else '-'
secs = float(sys.argv[2]) if len(sys.argv) > 2 else 12.0

prelude = ''
if idx != '-':
    prelude = f'globalThis.WZM_FPS_INDEX={int(idx)};\n'

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
done = {'v': False}


def on_message(message, _):
    row = message.get('payload', message)
    print(json.dumps(row)[:600], flush=True)
    if isinstance(row, dict) and row.get('s') == 'fpsProbeDone':
        done['v'] = True


script = session.create_script(prelude + (here / 'fps_cap_probe.js').read_text())
script.on('message', on_message)
script.load()
end = time.monotonic() + secs
while time.monotonic() < end and not done['v']:
    time.sleep(0.2)
time.sleep(0.2)
try:
    script.unload()
    session.detach()
except Exception:
    pass
