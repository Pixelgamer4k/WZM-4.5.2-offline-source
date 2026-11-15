#!/usr/bin/env python3
"""List live dvar names/values for a regex, read-only.

Usage: dvar_lookup.py <regex> [limit]
Uses dvar_enum.js (same verified registry scanner as gfx_apply.js).
"""
import json
import pathlib
import re
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
pat = re.compile(sys.argv[1], re.I)
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 40

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
script = session.create_script((here / 'dvar_enum.js').read_text())
script.load()
rows = script.exports_sync.named()
print(f'named dvars: {len(rows)}')
hits = [r for r in rows if pat.search(r.get('name') or '')]
print(f'matching /{sys.argv[1]}/: {len(hits)}')
for r in hits[:limit]:
    print(f"{r['name']:<34} cur={r['cur']!s:<10} def={r['def']!s:<10} type={r['type']} h={r['h']}")
try:
    script.unload()
    session.detach()
except Exception:
    pass
