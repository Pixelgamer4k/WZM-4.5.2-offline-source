#!/usr/bin/env python3
"""mem_peek.py <addr> [before] [after]...: read-only hex dump of the running game's memory around
addresses, plus the module/range each pointer-looking qword falls in."""
import pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
JS=r"""
rpc.exports={peek(a,before,after){
 const p=ptr(a).sub(before),out=[];
 for(let o=0;o<before+after;o+=8){
  let v;try{v=p.add(o).readU64();}catch(e){out.push([o-before,'unreadable']);continue;}
  let note='';
  try{const q=ptr(v.toString());const m=Process.findModuleByAddress(q);
   if(m)note=m.name+'+'+q.sub(m.base).toString(16);
   else{const r=Process.findRangeByAddress(q);if(r)note='heap '+r.protection;}
   if(note)try{const s=q.readCString(40);if(s&&/^[\x20-\x7e]{3,}$/.test(s))note+=' "'+s+'"';}catch(e){}
  }catch(e){}
  out.push([o-before,v.toString(16).padStart(16,'0'),note]);
 }
 const m=Process.findModuleByName('libgame.so');
 return {base:m.base.toString(),rows:out};
}};
"""
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS);sc.load()
try:
    a=sys.argv[1:];before=int(a[1],0) if len(a)>1 else 0x40;after=int(a[2],0) if len(a)>2 else 0x80
    r=sc.exports_sync.peek(a[0],before,after)
    print('libgame base',r['base'])
    for row in r['rows']:print(f"{row[0]:+#06x}",*row[1:])
finally:
    sc.unload();s.detach()
