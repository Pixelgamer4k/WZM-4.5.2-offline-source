"""gfx_early.py [timeout]: after launch, attach to the new game process and run gfx_early.js until the streaming setup has run."""
import sys,time,json,subprocess,threading,frida
from pathlib import Path
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
deadline=time.time()+float(sys.argv[1] if len(sys.argv)>1 else 60)
src=Path(__file__).with_name('gfx_early.js').read_text()
dev=frida.get_device_manager().add_remote_device('127.0.0.1:27042')
done=threading.Event();tried=set()
def msg(m,_):
    p=m.get('payload',m);print(json.dumps(p),flush=True)
    if p.get('s')=='gfxEarlyDone':done.set()
while time.time()<deadline and not done.is_set():
    o=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()
    pid=int(o[-1]) if o else None
    if not pid or pid in tried: time.sleep(0.1);continue
    try:
        s=dev.attach(pid);j=s.create_script(src);j.on('message',msg);j.load()
        print(json.dumps({'s':'gfxEarlyAttached','pid':pid}),flush=True);tried.add(pid)
        while time.time()<deadline and not done.is_set():
            time.sleep(0.2)
            if s.is_detached: break
        if done.is_set():
            time.sleep(0.5)
            try:j.unload();s.detach()
            except Exception:pass
    except Exception as e:
        print(json.dumps({'s':'gfxEarlyAttachFail','pid':pid,'e':str(e)[:80]}),flush=True);tried.add(pid);time.sleep(0.2)
if not done.is_set(): print('{"s":"gfxEarlyTimeout"}')
