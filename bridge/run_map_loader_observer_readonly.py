#!/usr/bin/env python3
"""Save passive WZM map-loader/error events without initiating a game action.

Does NOT launch, restart, force a gate, request a map, edit files, or interact
with phone UI. Requires an already running WZM process and Frida server.
Use with explicit user approval when their phone is available again.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import time

import frida

DEVICE = 'PHONE_IP:5555'
PACKAGE = 'com.activision.callofduty.warzone'
JS = Path(__file__).with_name('map_loader_observer_readonly.js')
ROOT = Path(__file__).resolve().parents[2]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--seconds', type=float, default=45)
    ap.add_argument('--output-dir', type=Path,
                    default=ROOT / 'runtime/map_diagnostics')
    args = ap.parse_args()
    if not 1 <= args.seconds <= 180:
        ap.error('seconds must be between 1 and 180')
    pid = subprocess.check_output(['adb','-s',DEVICE,'shell','pidof',PACKAGE],
                                  timeout=7).decode().strip()
    if not pid.isdigit():
        raise RuntimeError('Expected exactly one preexisting WZM process; refusing launch')
    # Local ADB TCP forwarding does not start a game or change any game state.
    subprocess.check_call(['adb','-s',DEVICE,'forward','tcp:27042','tcp:27042'],
                          stdout=subprocess.DEVNULL, timeout=7)
    remote = frida.get_device_manager().add_remote_device('127.0.0.1:27042')
    session = remote.attach(int(pid))
    out = args.output_dir / ('map_loader_' + pid + '_' +
                             datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.jsonl')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if out.exists():
        raise FileExistsError(out)
    script = session.create_script(JS.read_text())
    started = time.monotonic()
    count = [0]
    with out.open('x', encoding='utf-8') as stream:
        def got(message, data):
            body = message.get('payload') if message.get('type') == 'send' else message
            stream.write(json.dumps({'pid':int(pid),'event':body},ensure_ascii=False)+'\n')
            stream.flush()
            count[0] += 1
        script.on('message', got)
        try:
            script.load()
            while time.monotonic() - started < args.seconds:
                time.sleep(0.3)
        finally:
            try: script.unload()
            finally: session.detach()
    print(json.dumps({'status':'passive_capture_complete','pid':int(pid),
                      'events':count[0], 'output':str(out)}))


if __name__ == '__main__':
    main()
