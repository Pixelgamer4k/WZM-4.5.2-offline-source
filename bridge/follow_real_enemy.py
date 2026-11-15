#!/usr/bin/env python3
"""After the proven enemy inject finishes, add one original marker-2 Veteran AI."""
import json
import pathlib
import sys
import time

import frida

here = pathlib.Path(__file__).resolve().parent
runtime = here.parents[1] / 'runtime' / 'match_entry_20261102'
launch = here.parents[1] / 'runtime' / 'bot_fix_20261105' / 'reboot_bots_launch.log'
out = here.parents[1] / 'runtime' / 'bot_fix_20261105' / 'reboot_real_enemy.jsonl'

def say(row):
    row.setdefault('captureEpochMs', int(time.time() * 1000))
    line = json.dumps(row)
    with out.open('a') as handle:
        handle.write(line + '\n')
    print(line, flush=True)

out.write_text('')
deadline = time.monotonic() + 900
tag = None
while time.monotonic() < deadline:
    text = launch.read_text(errors='replace') if launch.exists() else ''
    if 'Session ' in text:
        for line in text.splitlines():
            if line.startswith('Session '):
                tag = line.split()[1].rstrip(':')
        break
    time.sleep(2)
if not tag:
    say({'s': 'realEnemyNoSession'})
    sys.exit(1)
say({'s': 'realEnemyWatching', 'tag': tag})
inject = runtime / f'{tag}.botinject.jsonl'
host = runtime / f'{tag}.log'
seen = False
while time.monotonic() < deadline:
    if inject.exists() and 'botInjectFinal' in inject.read_text(errors='replace'):
        seen = True
        break
    if inject.exists() and 'botInjectError' in inject.read_text(errors='replace'):
        say({'s': 'realEnemySkipped', 'reason': 'proven inject failed'})
        sys.exit(1)
    time.sleep(1)
if not seen:
    say({'s': 'realEnemyTimeout', 'tag': tag})
    sys.exit(1)
pid = None
for line in host.read_text(errors='replace').splitlines():
    try:
        row = json.loads(line)
    except ValueError:
        continue
    if row.get('s') == 'attachedProcess':
        pid = row['pid']
if pid is None:
    say({'s': 'realEnemyNoPid', 'tag': tag})
    sys.exit(1)
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
done = {'ok': False, 'err': False}

def on_message(message, _):
    row = message.get('payload', message)
    if not isinstance(row, dict):
        row = {'s': 'fridaMessage', 'value': str(row)}
    say(row)
    if row.get('s') == 'botInjectFinal':
        done['ok'] = True
    if row.get('s') == 'botInjectError' or message.get('type') == 'error':
        done['err'] = True

trial = session.create_script((here / 'native_ai_bot_trial.js').read_text() + '\nglobalThis.wzmBotArm();\n')
trial.on('message', on_message)
trial.load()
end = time.monotonic() + 30
while time.monotonic() < end and not done['ok'] and not done['err']:
    time.sleep(0.2)
if not done['ok']:
    say({'s': 'realEnemyCreateFailed', 'pid': pid})
    sys.exit(1)
done['ok'] = False
guard = session.create_script((here / 'native_ai_veteran_guard.js').read_text() + '\nglobalThis.wzmBotArm();\n')
guard.on('message', on_message)
guard.load()
say({'s': 'realEnemyVeteranGuard', 'pid': pid, 'tag': tag})
try:
    while True:
        time.sleep(30)
except KeyboardInterrupt:
    pass
