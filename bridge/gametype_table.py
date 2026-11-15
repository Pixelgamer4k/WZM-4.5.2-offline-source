#!/usr/bin/env python3
"""gametype_table.py <mode hash>: read-only. Finds the GameTypeTable asset (type 0xc0) named after a mode
(0x3ab2464 does the same) and prints each game type's hash and first name strings."""
import pathlib,subprocess,sys,json
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
JS=r"""
rpc.exports={read(h){
 const b=Process.findModuleByName('libgame.so').base;
 const find=new NativeFunction(b.add(0x19a9930),'pointer',['int','uint64','int']);
 const a=find(0xc0,uint64('0x'+h),0);if(a.isNull())return null;
 const l=a.add(0x10).readPointer(),n=l.add(8).readU32(),arr=l.add(0x10).readPointer(),out=[];
 const str=p=>{try{const s=p.readCString(48);return /^[\x20-\x7e]{2,}$/.test(s)?s:null;}catch(e){return null;}};
 for(let i=0;i<n;i++){const e=arr.add(i*8).readPointer();if(e.isNull())continue;
  const names=[];for(let o=8;o<0x60&&names.length<4;o+=8){try{const s=str(e.add(o).readPointer());if(s)names.push(s);}catch(x){}}
  try{const raw=new Uint8Array(e.readByteArray(0x200));let cur='';for(const c of raw){if(c>=0x20&&c<0x7f)cur+=String.fromCharCode(c);else{if(cur.length>=3)names.push(cur);cur='';}}}catch(x){}
  out.push({i,hash:e.readU64().and(uint64('0x7fffffffffffffff')).toString(16),names});}
 return {asset:a.toString(),n,list:out};}};
"""
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode().split()[0])
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS);sc.load()
try:
    r=sc.exports_sync.read(sys.argv[1])
    if not r:print('not registered')
    else:
        print('asset',r['asset'],'entries',r['n'])
        for e in r['list']:print(e['i'],e['hash'],e['names'])
finally:
    sc.unload();s.detach()
