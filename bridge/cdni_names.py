#!/usr/bin/env python3
"""Print the CDNI state name table (0x5337bf0) from the running game."""
import pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
JS="""
const b=Process.getModuleByName('libgame.so').base,t=b.add(0x5337bf0),o=[];
for(let i=0;i<48;i++){let s=null;try{const p=t.add(i*8).readPointer();s=p.readCString(48);}catch(e){s=null;}o.push(i+':'+s);}
send(o);
"""
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS);sc.on('message',lambda m,_:print('\n'.join(m.get('payload',[str(m)]))));sc.load();sc.unload();s.detach()
