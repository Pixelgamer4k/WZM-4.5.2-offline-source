#!/usr/bin/env python3
"""Capture existing WZM scene, tutorial bindings and zone state; never start a match.

Uses the existing game-thread Lua bridge for table introspection only. Attaching
Frida and executing introspection is instrumentation, not a zero-impact read.
Requires the exact 4.5.2 build and an already running menu. No restart or patch.
"""
import argparse,json,re,subprocess,threading
from pathlib import Path
import frida
HERE=Path(__file__).resolve().parent

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--device',default='PHONE_IP:5555')
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args()
    if args.output.exists(): ap.error('output already exists; choose a new capture filename')
    def adb(*a): return subprocess.check_output(['adb','-s',args.device,*a],timeout=10).decode().strip()
    metadata=adb('shell','dumpsys','package','com.activision.callofduty.warzone')
    if not re.search(r'versionCode=3953\b',metadata) or not re.search(r'versionName=4\.5\.2\.22729281\s',metadata):
        raise RuntimeError('Unsupported game version; address-specific bridge not attached')
    pid=adb('shell','pidof','com.activision.callofduty.warzone')
    if not pid.isdecimal(): raise RuntimeError('Expected one already-running game process')
    adb('forward','tcp:27042','tcp:27042')
    session=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(pid))
    scripts=[]; result={'pid':int(pid),'device':args.device,'version':'4.5.2.22729281 (3953)','events':[]}; done=threading.Event()
    try:
        bridge=session.create_script((HERE/'lua_exec.js').read_text());scripts.append(bridge)
        def message(m,_):
            result['events'].append(m)
            if m.get('type')=='send' and m['payload'].get('kind')=='lua_result':
                result['lua']=m['payload']['out'];done.set()
        bridge.on('message',message);bridge.load()
        bridge.exports_sync.run((HERE/'ftue_bindings_snapshot.lua').read_text())
        if not done.wait(10): raise RuntimeError('No game-thread callback; no host action was requested')
        if result['lua'].get('load')!=0 or result['lua'].get('pcall')!=0:
            raise RuntimeError('Introspection Lua failed: '+str(result['lua']))
        reader=session.create_script('''
const m=Process.getModuleByName('libgame.so');
function readName(p){const b=new Uint8Array(p.readByteArray(64));const n=b.indexOf(0);return String.fromCharCode(...b.subarray(0,n<0?63:n));}
rpc.exports={read(address){
 const p=ptr(address), ffid=p.add(10).readU8();
 const out={object:address,ffid};
 if(ffid===1){
  const f=p.add(0x28).readPointer(),r=Process.findRangeByAddress(f);
  out.executable=!!r&&r.protection.includes('x');
  if(f.compare(m.base)>=0&&f.compare(m.base.add(m.size))<0)
   out.nativeOffset=f.sub(m.base).toString();
 }
 return out;
},scene(){return {requestedName:readName(m.base.add(0x6d9dc78)),requestFlag:m.base.add(0x6d9dcb8).readU32(),partyActiveGate:m.base.add(0x613a4f0+0x4418).readU8()};}};
''');scripts.append(reader);reader.load()
        result['bindings']={}
        for line in (result['lua'].get('result') or '').splitlines():
            match=re.fullmatch(r'(\w+) ([0-9a-f]{16}) function: (0x[0-9a-f]+)',line)
            if match: result['bindings'][match[1]+' '+match[2]]=reader.exports_sync.read(match[3])
        result['nativeScene']=reader.exports_sync.scene()
        zone=session.create_script((HERE/'zone_lifecycle_observer_readonly.js').read_text());scripts.append(zone);zone.load()
        result['zones']=zone.exports_sync.snapshot();zone.exports_sync.stop()
        if adb('shell','pidof','com.activision.callofduty.warzone')!=pid: raise RuntimeError('Process changed during capture')
    finally:
        for script in reversed(scripts): script.unload()
        session.detach()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x') as f: json.dump(result,f,indent=2)
    print(json.dumps({'output':str(args.output),'pid':int(pid),'bindings':result['bindings'],'nativeScene':result['nativeScene']}))
if __name__=='__main__': main()
