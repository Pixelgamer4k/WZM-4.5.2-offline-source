#!/usr/bin/env python3
"""Live WZM Crash2 3P camera toggle: in-game 3P/1P button plus Mac console.

Usage: ../../frida_venv/bin/python3 tp_toggle_live.py
Commands from Mac console: t = toggle, 3 = third-person, 1 = first-person,
 s = status, q = detach and return to first-person.
Running this tool does not replace or edit the game's APK, files or bot launcher.
"""
from pathlib import Path
import json, subprocess, sys, time
import frida
from device_pid import resolve_game_pid

HERE = Path(__file__).resolve().parent
DEV = 'PHONE_IP:5555'
subprocess.run(['adb', '-s', DEV, 'forward', 'tcp:27042', 'tcp:27042'], check=True,
               stdout=subprocess.DEVNULL)
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
script = session.create_script((HERE / 'tp_live_toggle.bundle.js').read_text())

def callback(message, _binary):
    if message.get('type') == 'error':
        print('JS ERROR:', message.get('stack', message), flush=True)
    elif message.get('type') == 'send':
        obj = message.get('payload', {})
        print(json.dumps(obj, separators=(',', ':'))[:1100], flush=True)

script.on('message', callback)
script.load()
try:
    print('Tap the 3P / 1P button at the top center of the phone screen.', flush=True)
    print('Mac commands: t = toggle, 3 = third-person, 1 = first-person, s = status, q = restore and quit.', flush=True)
    while True:
        try:
            cmd = input('TP> ').strip().lower()
        except EOFError:
            # An interactive terminal is required; do not detach prematurely on empty stdin.
            print('No interactive input. Keeping touch toggle active; Ctrl-C to restore.',flush=True)
            while True:time.sleep(5)
        if cmd in ('q', 'quit', 'exit'):
            break
        try:
            if cmd in ('t','toggle'):
                result=script.exports_sync.toggle()
            elif cmd in ('3','on','enable'):
                result=script.exports_sync.enable()
            elif cmd in ('1','off','disable'):
                result=script.exports_sync.disable()
            elif cmd in ('s','status',''):
                result=script.exports_sync.state()
            else:
                print('Unknown command. Use t, 3, 1, s or q.',flush=True)
                continue
            print('STATE:', json.dumps(result), flush=True)
        except Exception as exc:
            print('CONTROL ERROR:', exc, flush=True)
except KeyboardInterrupt:
    print('\nStopping third-person controller...',flush=True)
finally:
    try: print('RESTORE:',script.exports_sync.shutdown(),flush=True)
    except Exception as exc:print('RESTORE NOTE:',exc,flush=True)
    try:script.unload()
    finally:session.detach()
