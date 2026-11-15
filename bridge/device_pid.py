"""Resolve the actual game process without guessing among duplicate pidof results."""
import re
import subprocess

PACKAGE = 'com.activision.callofduty.warzone'

def choose_pid(candidates, cmdlines, activity_top, package=PACKAGE):
    if len(candidates) == 1:
        return candidates[0]
    canonical = [p for p in candidates if cmdlines.get(p, '').split('\0', 1)[0] == package]
    if len(canonical) == 1:
        return canonical[0]
    active = [int(p) for name, p in re.findall(r'ACTIVITY\s+(\S+)\s+[^\n]*?pid=(\d+)', activity_top)
              if name.split('/', 1)[0] == package and int(p) in candidates]
    active = list(dict.fromkeys(active))
    if len(active) == 1 and (not canonical or active[0] in canonical):
        return active[0]
    raise RuntimeError(f'Game PID ambiguous: candidates={candidates}, canonical={canonical}')

def resolve_game_pid(device='PHONE_IP:5555', package=PACKAGE):
    def adb(command):
        return subprocess.check_output(['adb', '-s', device, 'shell', command], timeout=10).decode(errors='replace')
    candidates = [int(p) for p in adb('pidof '+package).split() if p.isdecimal()]
    if not candidates:
        raise RuntimeError('Game is not running')
    cmdlines = {}
    if len(candidates) > 1:
        for pid in candidates:
            try:
                cmdlines[pid] = adb(f"su -c 'cat /proc/{pid}/cmdline'")
            except subprocess.CalledProcessError:
                pass
        activity = adb('dumpsys activity top')
    else:
        activity = ''
    return choose_pid(candidates, cmdlines, activity, package)
