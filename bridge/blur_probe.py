#!/usr/bin/env python3
"""Locate (and optionally enable) radial motion blur.

Usage: blur_probe.py [find | 0|1|2 ...]
Read-only when the argument is 'find'.
"""
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
mode = sys.argv[1] if len(sys.argv) > 1 else 'find'
prelude = '' if mode == 'find' else f'globalThis.WZM_BLUR_MODE={int(mode)};\n'

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
rows = []
script = session.create_script(prelude + (here / 'blur_find.js').read_text())
script.on('message', lambda m, _: rows.append(m.get('payload', m)))
script.load()
time.sleep(6)
for r in rows:
    if isinstance(r, dict):
        print(json.dumps(r)[:1200], flush=True)
    else:
        print(str(r)[:400])
try:
    script.unload()
    session.detach()
except Exception:
    pass
