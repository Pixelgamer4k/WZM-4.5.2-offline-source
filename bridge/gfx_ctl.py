"""gfx_ctl.py get HASH | set HASH VALUE [HASH VALUE ...] | dump OUT.json  (live, memory-only)"""
import sys,json,frida
from pathlib import Path
from device_pid import resolve_game_pid
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
j=s.create_script(Path(__file__).with_name('gfx_set.js').read_text());j.load();e=j.exports_sync
a=sys.argv[1:]
if a[0]=='get':
    for h in a[1:]:print(h,e.get(h))
elif a[0]=='set':
    for h,v in zip(a[1::2],a[2::2]):print(h,e.set(h,float(v) if '.' in v else int(v)))
elif a[0]=='dump':json.dump(e.dump(),open(a[1],'w'));print('dvars',e.count())
j.unload();s.detach()
