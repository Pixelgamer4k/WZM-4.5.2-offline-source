#!/usr/bin/env python3
"""Wait for the actual menu frame with one late, bounded Frida attachment."""
import json
import pathlib
import subprocess
import sys
import threading

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'frida_venv/lib/python3.13/site-packages'))
import frida

D = 'PHONE_IP:5555'
TIMEOUT = int(sys.argv[1]) if len(sys.argv) > 1 else 60
if not 5 <= TIMEOUT <= 180:
    raise SystemExit('probe timeout must be 5..180 seconds')

subprocess.check_call(['adb', '-s', D, 'forward', 'tcp:27042', 'tcp:27042'], stdout=subprocess.DEVNULL)
from device_pid import resolve_game_pid

pid = resolve_game_pid()
session = None
script = None
done = threading.Event()
result = {'ready': False, 'error': None}

def on_message(message, _data):
    if message.get('type') == 'error':
        result['error'] = message.get('description', 'Frida script error')
        done.set()
        return
    payload = message.get('payload', {})
    if payload.get('frontendMenuFrame'):
        result['ready'] = True
        done.set()
    elif payload.get('probeError'):
        result['error'] = payload['probeError']
        done.set()

try:
    session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
    script = session.create_script(r"""
const mod = Process.findModuleByName('libgame.so');
if (mod === null) {
  send({probeError: 'libgame.so is not loaded'});
} else {
  let fired = false;
  Interceptor.attach(mod.base.add(0x337c1c0), {
    onEnter() {
      if (!fired) {
        fired = true;
        send({frontendMenuFrame: true});
      }
    }
  });
}
""")
    script.on('message', on_message)
    script.load()
    done.wait(TIMEOUT)
finally:
    if script is not None:
        try:
            script.unload()
        except Exception:
            pass
    if session is not None:
        try:
            session.detach()
        except Exception:
            pass

print(json.dumps({'pid': pid, **result, 'timeoutSeconds': TIMEOUT}))
sys.exit(0 if result['ready'] else 1)
