"""mbvk_run.py [seconds]: attach mbvk.js (frame-blending motion blur) to each newly launched game process
as early as possible (before the swapchain is created) and keep it loaded while the process lives."""
import sys,time,json,os,subprocess,threading,frida
from pathlib import Path
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
deadline=time.time()+float(sys.argv[1] if len(sys.argv)>1 else 7200)
env={k:float(os.environ[v]) for k,v in (('max','WZM_MBLUR_MAX'),('gain','WZM_MBLUR_GAIN')) if os.environ.get(v)}
src='globalThis.WZM_MBVK_ENV='+json.dumps(env)+';\n'+Path(__file__).with_name('mbvk.js').read_text()
dev=frida.get_device_manager().add_remote_device('127.0.0.1:27042')
def pids():
    o=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()
    return {int(x) for x in o if x.isdecimal()}
known=pids();print(json.dumps({'s':'mbvkRunStart','existing':sorted(known)}),flush=True)
while time.time()<deadline:
    new=sorted(pids()-known)
    if not new:time.sleep(0.05);continue
    pid=new[-1];known.add(pid)
    try:
        s=dev.attach(pid);j=s.create_script(src)
        j.on('message',lambda m,_:print(json.dumps(m.get('payload',m))[:400],flush=True));j.load()
        print(json.dumps({'s':'mbvkAttached','pid':pid}),flush=True)
        while time.time()<deadline and not s.is_detached:time.sleep(1)
        print(json.dumps({'s':'mbvkDetached','pid':pid}),flush=True)
    except Exception as e:
        print(json.dumps({'s':'mbvkAttachFail','pid':pid,'e':str(e)[:120]}),flush=True)
