#!/usr/bin/env python3
"""watch.py <seconds> <shot_dir>: retain fence bridge; optional passive native observer."""
import json,os,pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone';here=pathlib.Path(__file__).parent
dur=int(sys.argv[1]);shots=pathlib.Path(sys.argv[2]);t0=time.time();log=[]
shots.mkdir(parents=True, exist_ok=True)
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
from device_pid import resolve_game_pid
pid=resolve_game_pid()
def msg(m,_):
    e=m.get('payload',m);e['t']=round(time.time()-t0,1);log.append(e);print(json.dumps(e)[:1200],flush=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(pid))
for _ in range(60):
    probe=s.create_script("send(Process.findModuleByName('libgame.so')!==null)");r=[]
    probe.on('message',lambda m,_:r.append(m.get('payload')));probe.load();probe.unload()
    if r and r[0]:break
    time.sleep(0.25)
extra=None
if os.environ.get('WZM_PASSIVE_ORIGINAL_MODE')=='1':
    # Observe legitimate native events *before* the existing Lua frontend
    # bridge runs. No native calls or memory writes in this optional script.
    observer=here.parents[1]/'community_fence_transfer'/'passive_original_mode.js'
    extra=s.create_script(observer.read_text())
    extra.on('message',msg);extra.load()
    print('passive original-mode hooks armed',flush=True)
sc=s.create_script((here/'watch.js').read_text());sc.on('message',msg);sc.load()
sc.exports_sync.start((here/'skip_online_fences.lua').read_text())
try:
    n=0
    while time.time()-t0<dur:
        time.sleep(2.5);n+=1
        with open(shots/f'w{n:02d}.png','wb') as f:subprocess.run(['adb','-s',D,'exec-out','screencap','-p'],stdout=f,timeout=10)
finally:
    if extra:
        try:extra.unload()
        except Exception as e:print('observer unload',e)
    try:sc.unload()
    except Exception as e:print('unload',e)
    try:s.detach()
    except Exception as e:print('detach',e)
    (here/f'watch_{pid}_{int(t0)}.json').write_text(json.dumps(log,indent=1))
    print('events',len(log))
