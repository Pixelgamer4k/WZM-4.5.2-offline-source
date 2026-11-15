#!/usr/bin/env python3
"""tick.py: is the level state machine tick running, and what does its condition return?"""
import pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script("""const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);let n=0;
Interceptor.attach(at(0x3abb6e4),{onEnter(){n++;}});
setTimeout(()=>send({ticks:n,state:at(0xc11a688).readS32(),name:at(0xc11a68c).readCString(32).split('\\ufffd')[0]}),3000);""")
sc.on('message',lambda m,_:print(m.get('payload',m)));sc.load();time.sleep(4);sc.unload();s.detach()
