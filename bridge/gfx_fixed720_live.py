#!/usr/bin/env python3
"""Attach persistent, reversible 640p internal render/zero DRS to the running match.
Use Ctrl+C to detach and restore the earlier settings. No APK/UI/display writes.
New matches get the default profile automatically via play_offline.sh.
"""
import pathlib,subprocess,threading,time,sys,frida
from device_pid import resolve_game_pid
D='PHONE_IP:5555'
HERE=pathlib.Path(__file__).resolve().parent
# Do not install a competing writer over a session already managed by the
# default fixed-resolution profile in host_spawn.py. This is for standalone
# sessions explicitly started with WZM_GFX_FIXED640=0, not the default.
for line in subprocess.run(['ps','-axo','pid=,command='],capture_output=True,text=True,check=True).stdout.splitlines():
 if 'host_spawn.py' not in line or 'grep' in line:continue
 fields=line.strip().split(None,1)
 if not fields or not fields[0].isdigit():continue
 envline=subprocess.run(['ps','eww','-p',fields[0]],capture_output=True,text=True).stdout
 if 'WZM_GFX_FIXED640=1' in envline and 'WZM_GFX=1' in envline:
  print('Fixed 640p / zero dynamic-width profile is already active in the match launcher. No second hook needed.',flush=True)
  sys.exit(0)
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
sc=s.create_script((HERE/'gfx_fixed720_live.js').read_text());dead=threading.Event()
s.on('detached',lambda *a:dead.set())
sc.on('destroyed',lambda *a:dead.set())
def message(m,_):
 if m.get('type')=='error':print('GRAPHICS ERROR',m.get('stack',m),flush=True)
 elif m.get('type')=='send':print('GRAPHICS:',m.get('payload',{}),flush=True)
sc.on('message',message)
sc.load()
try:
 print('Fixed 640p graphics active. Keep this process running. Ctrl+C restores prior settings.',flush=True)
 while not dead.is_set():
  time.sleep(5)
  if not dead.is_set():
   info=sc.exports_sync.status()
   if info.get('errors'):print('GRAPHICS STATUS:',info,flush=True)
except KeyboardInterrupt:
 print('Restoring prior graphics settings...',flush=True)
finally:
 if not dead.is_set():
  try:print('RESTORED:',sc.exports_sync.stop(),flush=True)
  except Exception as e:print('RESTORE ERROR:',e,flush=True)
 try:sc.unload()
 except Exception:pass
 try:s.detach()
 except Exception:pass
