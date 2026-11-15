#!/usr/bin/env python3
"""Read-only wall-clock profiler for the online sim frame.

Usage: frame_profiler.py [samples=200] [interval_ms=4]

Samples the stack of every thread in the game process at a fixed cadence and
aggregates the innermost libgame.so frame. This finds the function the frame is
sitting in while fps is depressed. No hooks, no writes, no Interceptor: purely
Thread.backtrace via a timer, so it cannot perturb the state we are measuring.
"""
import collections
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
samples = int(sys.argv[1]) if len(sys.argv) > 1 else 200
interval = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0

SRC = '''
const mod = Process.getModuleByName('libgame.so');
const base = mod.base;
const rel = p => { try { const d = p.sub(base); return d.compare(0) >= 0 && d.compare(mod.size) < 0 ? 'libgame+0x' + d.toString(16) : null; } catch (e) { return null; } };
rpc.exports.sample = function () {
  const out = [];
  for (const th of Process.enumerateThreads()) {
    let bt = [];
    try { bt = Thread.backtrace(th.context, Backtracer.ACCURATE); } catch (e) { continue; }
    const frames = [];
    for (const f of bt.slice(0, 14)) { const r = rel(f); if (r) frames.push(r); }
    if (frames.length) out.push({ tid: th.id, frames });
  }
  return out;
};
'''

pid = resolve_game_pid()
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
script = session.create_script(SRC)
script.load()

inner = collections.Counter()
thread_of_inner = collections.Counter()
thread_hits = collections.Counter()
t0 = time.monotonic()
for _ in range(samples):
    for row in script.exports_sync.sample():
        td = row['tid']
        thread_hits[td] += 1
        if row['frames']:
            inner[row['frames'][0]] += 1
            thread_of_inner[(row['frames'][0], td)] += 1
    time.sleep(interval / 1000.0)
elapsed = time.monotonic() - t0
try:
    script.unload()
    session.detach()
except Exception:
    pass

total = sum(inner.values()) or 1
print(json.dumps({'s': 'profile', 'pid': pid, 'seconds': round(elapsed, 2),
                  'samples': samples, 'threadsSampled': len(thread_hits)}))
print('top innermost libgame frames:')
for fn, n in inner.most_common(25):
    print(f'  {fn:<26} {n:>6}  {100.0*n/total:5.1f}%')
print('busiest threads by sample count:')
for td, n in thread_hits.most_common(8):
    print(f'  tid {td:<8} {n:>6}')
