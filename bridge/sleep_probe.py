#!/usr/bin/env python3
"""Is the engine putting itself to sleep to hold a frame rate?

Hooks libc nanosleep / usleep / clock_nanosleep read-only and histograms the
requested sleep durations for a window. A frame limiter shows up as a tight
cluster: ~33.3 ms => target 30 fps, ~16.7 ms => target 60 fps, none => no limiter
(frame rate limited by work instead).

Usage: sleep_probe.py [seconds=4]
"""
import json
import sys
import time

import frida
from device_pid import resolve_game_pid

secs = float(sys.argv[1]) if len(sys.argv) > 1 else 4.0

SRC = '''
const bins = {};
let total = 0, armed = false;
function note(us){
  total++;
  const ms = Math.round(us / 1000);
  let k;
  if (ms <= 1) k = '0-1ms'; else if (ms <= 5) k = '2-5ms'; else if (ms <= 10) k = '6-10ms';
  else if (ms <= 14) k = '11-14ms'; else if (ms <= 18) k = '15-18ms'; else if (ms <= 22) k = '19-22ms';
  else if (ms <= 28) k = '23-28ms'; else if (ms <= 36) k = '29-36ms'; else if (ms <= 50) k = '37-50ms';
  else k = '>50ms';
  bins[k] = (bins[k] || 0) + 1;
}
function hook(name, argIndex, scale){
  try {
    const p = Module.getGlobalExportByName(name);
    Interceptor.attach(p, { onEnter(args) {
      if (!armed) return;
      try {
        const v = args[argIndex];
        if (v.isNull()) return;
        let us = 0;
        if (scale === 'timespec') { us = v.readU64().toNumber() * 1000000 + v.add(8).toNumber() / 1000; }
        else { us = v.toUInt32(); }
        note(us);
      } catch (e) {}
    }});
    return true;
  } catch (e) { return false; }
}
const hooked = {
  nanosleep: hook('nanosleep', 0, 'timespec'),
  usleep: hook('usleep', 0, 'us'),
  clock_nanosleep: hook('clock_nanosleep', 2, 'timespec')
};
rpc.exports = {
  start(){ armed = true; for (const k in bins) delete bins[k]; total = 0; return hooked; },
  stop(){ armed = false; return { total: total, bins: bins }; }
};
'''

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
script = session.create_script(SRC)
script.load()
print(json.dumps({'s': 'hooksInstalled', 'detail': script.exports_sync.start()}))
time.sleep(secs)
res = script.exports_sync.stop()
print(json.dumps({'s': 'sleepHistogram', 'seconds': secs, 'total': res['total'], 'bins': res['bins']}))
try:
    script.unload()
    session.detach()
except Exception:
    pass
