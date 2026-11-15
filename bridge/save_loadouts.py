#!/usr/bin/env python3
"""save_loadouts.py [file]: save the loadouts edited in Gear Up to disk (default ~/.wzm_loadouts.tsv).
Writes only when something was edited and the content changed."""
import ast,pathlib,subprocess,sys,time
here=pathlib.Path(__file__).parent
f=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path.home()/'.wzm_loadouts.tsv')
r=subprocess.run([str(here.parents[1]/'frida_venv/bin/python3'),str(here/'lua_exec.py'),'dump_loadouts.lua','60'],cwd=here,capture_output=True,text=True)
line=(r.stdout.strip().splitlines() or [''])[-1]
try: res=ast.literal_eval(line)['result']
except Exception: print('read failed:',line[:200]); sys.exit(1)
if res=='NOTHING_EDITED': print('nothing edited yet'); sys.exit(0)
old=f.read_text() if f.exists() else ''
if old.split('\n',1)[-1]==res.split('\n',1)[-1]: print('unchanged'); sys.exit(0)
if old: f.with_suffix('.tsv.bak').write_text(old)
f.write_text(res); print('saved',res.count('\n'),'fields to',f, time.strftime('%H:%M:%S'))
