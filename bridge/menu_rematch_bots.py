#!/usr/bin/env python3
"""Start another Nuketown match from the live main menu, then spawn enemies.

Does not reboot. The host hooks from the current play session stay loaded.
After the player is spawned, this runs the party apply + addtestclient path that
reached state 7 in play_20261105_205945, then the original AI creator that
produced the confirmed moving enemy.
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
out = pathlib.Path(sys.argv[2])
enemies = int(sys.argv[3]) if len(sys.argv) > 3 else 2
if not 1 <= enemies <= 4:
    raise SystemExit('enemies must be 1..4')

pid = resolve_game_pid()
out.parent.mkdir(parents=True, exist_ok=True)
sink = out.open('w')
lock = threading.Lock()

def report(row):
    row.setdefault('captureEpochMs', int(time.time() * 1000))
    line = json.dumps(row)
    with lock:
        sink.write(line + '\n')
        sink.flush()
        print(line, flush=True)

REMATCH = r'''
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const setGametype=new NativeFunction(at(0x1e51c3c),'void',['uint64']);
const hostStart=new NativeFunction(at(0x1621ab0),'void',[]);
const worldUnload=new NativeFunction(at(0x138462c),'void',['int']);
const prep1=new NativeFunction(at(0x134754c),'void',['int']);
const prep2=new NativeFunction(at(0x3a545c0),'void',[]);
const prep3=new NativeFunction(at(0x218fbd4),'void',[]);
const keep=[];
let started=false;
Interceptor.attach(at(0x337c1c0),{onLeave(){
  if(started)return;started=true;
  try{
    const map=Memory.allocUtf8String('mp_mgl_nuketown');keep.push(map);
    const dvar=at(0x54be5e8).readPointer().readPointer();
    if(dvar.isNull())throw Error('map dvar missing');
    dvar.add(0x28).writePointer(map);
    const wait=at(0x600f968).readPointer();
    if(!wait.isNull())wait.add(0x28).writeU32(60000);
    at(0xc115ea8).writeU8(11);at(0xc115eb0).writeU8(11);
    at(0xc115e88).writePointer(ptr(0));
    setGametype(uint64('0x3f9bd6e4038d651d'));
    prep1(0);prep2();prep3();
    const depth=at(0xb1beb40).add(0x58).readU32();
    worldUnload(1);
    send({s:'menuRematchPrep',depth});
    hostStart();
    send({s:'menuRematchHostReturned'});
  }catch(e){send({s:'menuRematchError',error:String(e)});}
}});
send({s:'menuRematchArmed',pid:Process.id});
'''

session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
report({'s': 'menuRematchAttach', 'pid': pid, 'logBytes': log.stat().st_size})
ready = threading.Event()
failed = threading.Event()

def on_message(message, _):
    row = message.get('payload', message)
    if not isinstance(row, dict):
        row = {'s': 'fridaMessage', 'value': str(row)}
    report(row)
    if row.get('s') == 'menuRematchHostReturned':
        ready.set()
    if row.get('s') == 'menuRematchError' or message.get('type') == 'error':
        failed.set()

script = session.create_script(REMATCH)
script.on('message', on_message)
script.load()
if not ready.wait(90):
    report({'s': 'menuRematchTimeout', 'failed': failed.is_set()})
    sys.exit(1)
offset = log.stat().st_size
report({'s': 'menuRematchWaitingForSpawn', 'logBytes': offset})

def wait_spawn(timeout):
    end = time.monotonic() + timeout
    pos = offset
    while time.monotonic() < end:
        with log.open('r', errors='replace') as handle:
            handle.seek(pos)
            chunk = handle.read()
            pos = handle.tell()
        if '"clientEnterWorld"' in chunk:
            return True
        time.sleep(0.5)
    return False

if not wait_spawn(180):
    report({'s': 'menuRematchNoEnterWorld'})
    sys.exit(1)
report({'s': 'menuRematchEntered'})

# Proven enemy path: party apply, then addtestclient, gamestate, enter-world.
env = {'partyMembers': True, 'teamFields': False, 'count': enemies, 'team': 1,
       'calls': enemies, 'friends': 0, 'diff': 0}
inject_source = 'globalThis.WZM_BOT_ENV=' + json.dumps(env) + ';\n' + (here / 'party_bot_inject.js').read_text()
inject_done = threading.Event()

def on_inject(message, _):
    row = message.get('payload', message)
    if not isinstance(row, dict):
        row = {'s': 'fridaMessage', 'value': str(row)}
    report(row)
    if row.get('s') in ('botInjectFinal', 'botInjectError') or message.get('type') == 'error':
        inject_done.set()

# Wait until the new match reports the player is not spectating.
end = time.monotonic() + 90
spawned = False
pos = offset
while time.monotonic() < end and not spawned:
    with log.open('r', errors='replace') as handle:
        handle.seek(pos)
        for line in handle:
            if '"matchProbe"' in line and 'spec=false' in line:
                spawned = True
                break
        pos = handle.tell()
    if not spawned:
        time.sleep(0.5)
if not spawned:
    report({'s': 'menuRematchNoLiveSpawn'})
    sys.exit(1)

inject = session.create_script(inject_source + '\nglobalThis.wzmBotArm();\n')
inject.on('message', on_inject)
inject.load()
if not inject_done.wait(60):
    report({'s': 'menuEnemyInjectTimeout'})
    sys.exit(1)

# One genuine marker-2 enemy, the creator that moved and shot after addtestclient.
ai_done = threading.Event()

def on_ai(message, _):
    row = message.get('payload', message)
    if not isinstance(row, dict):
        row = {'s': 'fridaMessage', 'value': str(row)}
    report(row)
    if row.get('s') in ('botInjectFinal', 'botInjectError') or message.get('type') == 'error':
        ai_done.set()

ai = session.create_script((here / 'native_ai_bot_trial.js').read_text() + '\nglobalThis.wzmBotArm();\n')
ai.on('message', on_ai)
ai.load()
if not ai_done.wait(30):
    report({'s': 'menuNativeAiTimeout'})
    sys.exit(1)
guard = session.create_script((here / 'native_ai_veteran_guard.js').read_text() + '\nglobalThis.wzmBotArm();\n')
guard.on('message', on_ai)
guard.load()
report({'s': 'menuEnemiesArmed', 'pid': pid, 'enemies': enemies})
# Keep the Veteran guard's code page alive for the match.
try:
    while True:
        time.sleep(30)
except KeyboardInterrupt:
    pass
