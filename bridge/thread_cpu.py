#!/usr/bin/env python3
"""Per-thread CPU attribution from /proc only (zero risk, no injection).

Usage: thread_cpu.py [pid] [seconds=3]

Reads utime+stime for every thread of the game process twice and reports the CPU
share each thread used in the window. 100% == one full core.
"""
import subprocess
import sys
import time

pid = sys.argv[1] if len(sys.argv) > 1 else subprocess.run(
    ['adb', 'shell', 'pidof com.activision.callofduty.warzone'],
    capture_output=True, text=True).stdout.strip().split('\n')[0]
secs = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
HZ = 100.0


def snap():
    out = subprocess.run(['adb', 'shell', f'for t in /proc/{pid}/task/*; do cat $t/stat 2>/dev/null; done'],
                         capture_output=True, text=True).stdout
    rows = {}
    for line in out.splitlines():
        try:
            lp, rp = line.index('('), line.rindex(')')
            name = line[lp + 1:rp]
            rest = line[rp + 2:].split()
            tid = int(line[:lp].strip())
            utime, stime = int(rest[11]), int(rest[12])
            state = rest[0]
            rows[tid] = (name, utime + stime, state)
        except (ValueError, IndexError):
            continue
    return rows


a = snap()
time.sleep(secs)
b = snap()
tot = {}
for tid, (name, ticks, state) in b.items():
    if tid in a:
        d = (ticks - a[tid][1]) / HZ
        if d > 0:
            tot.setdefault(name, [0.0, 0, state]) 
            tot[name][0] += d
            tot[name][1] += 1
            tot[name][2] = state
print(f'pid={pid} window={secs}s threads={len(b)}')
print(f'{"thread":<24}{"cpu%":>8}  {"instances":>9}  state')
for name, (cpu, n, state) in sorted(tot.items(), key=lambda kv: -kv[1][0])[:16]:
    print(f'{name:<24}{100.0*cpu/secs:8.1f}  {n:>9}  {state}')
print(f'total: {100.0*sum(v[0] for v in tot.values())/secs:.0f}% of one core-equivalent per second')
