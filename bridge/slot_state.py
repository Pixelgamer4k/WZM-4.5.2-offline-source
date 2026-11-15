#!/usr/bin/env python3
"""Read-only slot state dump (spectator vs live comparison).

Usage: slot_state.py [out.json]
Loads slot_state_snapshot.js, prints the snapshot, optionally appends to a JSONL.
"""
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
outfile = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
script = session.create_script((here / 'slot_state_snapshot.js').read_text())
rows = []
script.on('message', lambda m, _: rows.append(m.get('payload', m)))
script.load()
time.sleep(1.0)
if rows:
    row = rows[0]
    row['s'] = 'slotState'
    row['pid'] = pid
    row['captureEpochMs'] = int(time.time() * 1000)
    print(json.dumps(row, indent=1)[:2000])
    if outfile:
        with outfile.open('a') as h:
            h.write(json.dumps(row) + '\n')
else:
    print(json.dumps({'s': 'slotStateEmpty'}))
try:
    script.unload()
    session.detach()
except Exception:
    pass
