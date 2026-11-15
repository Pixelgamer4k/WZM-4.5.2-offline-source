#!/usr/bin/env python3
"""Retain the genuine native AI roster and Veteran guard for the match lifetime.

Usage: native_ai_roster_watch.py MATCH_LOG OUTPUT_JSONL [AI_COUNT=2] [SECONDS=3600]
This attaches only after the host log verifies the real human is in-world.
"""
import json
import pathlib
import sys
import threading
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
log = pathlib.Path(sys.argv[1])
out_path = pathlib.Path(sys.argv[2])
count = int(sys.argv[3]) if len(sys.argv) > 3 else 2
seconds = int(sys.argv[4]) if len(sys.argv) > 4 else 3600
if not 1 <= count <= 8 or not 60 <= seconds <= 14400:
    raise SystemExit('AI_COUNT must be 1..8 and SECONDS 60..14400')

pid = None
ready = False
end = time.monotonic() + min(360, seconds)
offset = 0
while time.monotonic() < end and not ready:
    if log.exists():
        with log.open('r', errors='replace') as f:
            f.seek(offset)
            for line in f:
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if row.get('s') == 'attachedProcess':
                    pid = row['pid']
                if row.get('s') == 'matchProbe' and 'spec=false' in row.get('text', ''):
                    ready = True
            offset = f.tell()
    if not ready:
        time.sleep(.5)
if not ready or pid is None:
    raise SystemExit('No original human-spawn witness; native AI roster not attached')
actual_pid = resolve_game_pid()
if actual_pid != pid:
    raise SystemExit(f'Host PID {pid} differs from active game PID {actual_pid}')

out_path.parent.mkdir(parents=True, exist_ok=True)
out = out_path.open('w')
gone = threading.Event()
initial = threading.Event()
write_lock = threading.Lock()
def report(row):
    row.setdefault('captureEpochMs', int(time.time() * 1000))
    s = json.dumps(row)
    with write_lock:
        out.write(s + '\n')
        out.flush()
        print(s, flush=True)

session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
session.on('detached', lambda *args: gone.set())
source = (here / 'native_ai_roster_trial.js').read_text()
script = session.create_script(
    'globalThis.WZM_NATIVE_AI_ROSTER=' + json.dumps({'count': count}) + ';\n'
    + source + '\nglobalThis.wzmBotArm();\n'
)
def on_message(message, _):
    row = message.get('payload', message)
    if not isinstance(row, dict):
        row = {'s': 'fridaMessage', 'value': str(row)}
    report(row)
    if row.get('s') in ('botInjectFinal', 'botInjectError') or message.get('type') == 'error':
        initial.set()
script.on('message', on_message)
try:
    script.load()
    if not initial.wait(min(120, seconds)):
        report({'s': 'nativeRosterInitialTimeout', 'pid': pid})
    else:
        report({'s': 'nativeRosterMonitoring', 'pid': pid, 'count': count})
    gone.wait(seconds)
finally:
    # Do not free the retained native code while 0x3cd7b20 still points at it.
    if not gone.is_set():
        for _ in range(20):
            try:
                status = script.exports_sync.stop()
                if status.get('stopped'):
                    report({'s': 'nativeRosterRestored', **status})
                    time.sleep(.1)
                    break
            except Exception as e:
                report({'s': 'nativeRosterStopError', 'error': str(e)})
                break
            time.sleep(.25)
        else:
            report({'s': 'nativeRosterStillBusy', 'detail': 'Gate remains armed; leave process attached'})
            # Avoid closing the Frida script and freeing the patched native gate.
            gone.wait()
    try:
        script.unload()
    except frida.InvalidOperationError:
        pass
    try:
        session.detach()
    except frida.InvalidOperationError:
        pass
    out.close()
