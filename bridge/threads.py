#!/usr/bin/env python3
"""threads.py: print each running game thread's libgame.so stack frames (ELF addresses)."""
import pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
JS=r"""
const m=Process.getModuleByName('libgame.so'),out=[];
const inG=a=>a.compare(m.base)>=0&&a.compare(m.base.add(m.size))<0;
for(const t of Process.enumerateThreads()){
 if(t.id===Process.getCurrentThreadId())continue;
 let f=[];try{f=Thread.backtrace(t.context,Backtracer.FUZZY).filter(inG).slice(0,26).map(a=>a.sub(m.base).toString());}catch(e){}
 if(f.length)out.push({id:t.id,name:t.name,state:t.state,f});
}
send(out);
"""
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS)
def msg(m,_):
    for t in m.get('payload',[m]) if m['type']=='send' else [m]:print(t)
sc.on('message',msg);sc.load();sc.unload();s.detach()
