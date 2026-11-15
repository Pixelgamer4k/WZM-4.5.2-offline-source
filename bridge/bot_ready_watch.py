"""Attach a bounded bot trial to the exact host PID, only after a real spawn probe."""
import sys,json,time,threading,os
from pathlib import Path
import frida
log=Path(sys.argv[1]);output=Path(sys.argv[2]);deadline=time.monotonic()+360
while time.monotonic()<deadline:
    if log.exists():
        rows=[]
        for line in log.read_text(errors='replace').splitlines():
            try: rows.append(json.loads(line))
            except ValueError: pass
        trig=os.environ.get('BOT_TRIGGER','spawn')
        if (trig=='enter' and any(r.get('s')=='clientEnterWorld' for r in rows)) or any(r.get('s')=='matchProbe' and 'spec=false' in r.get('text','') for r in rows):
            pid=next(r['pid'] for r in rows if r.get('s')=='attachedProcess');break
    time.sleep(.5)
else: raise SystemExit('No verified spawn; bot trial not attached')
_t=threading.Timer(float(os.environ.get('BOT_WAIT','8'))+12,lambda:os._exit(3));_t.start();done=threading.Event()
out=output.open('w')
def msg(m,_):
    p=m.get('payload',m);p.setdefault('captureEpochMs',int(time.time()*1000))
    v=json.dumps(p);out.write(v+'\n');out.flush();print(v,flush=True)
    if p.get('s') in ('botConnectResult','botConnectError','botConnectSkipped','botInjectFinal','botInjectError'):done.set()
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
j=s.create_script(Path(__file__).with_name(os.environ.get('BOT_AGENT','native_bot_connection_trace.js')).read_text()+'\nglobalThis.wzmBotArm();')
j.on('message',msg);j.load();done.wait(float(os.environ.get('BOT_WAIT','8')))
if os.environ.get('BOT_STAY')=='1':
    _t.cancel();gone=threading.Event();s.on('detached',lambda *a:gone.set());print('{"s":"botAgentStaying"}',flush=True);gone.wait();os._exit(0)
j.unload();s.detach();os._exit(0)
