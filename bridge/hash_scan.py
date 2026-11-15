#!/usr/bin/env python3
"""hash_scan.py <hex xhash> [...]: read-only search of the running game's memory for 64-bit asset
name hashes, to tell a module that is loaded but unregistered from one whose zone is not loaded.
Control: 6ac1fc715aaefeda (the LUIStartup chunk, present in global.ff) should be found."""
import pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
JS=r"""
rpc.exports={scan(hexes){
 const out={};
 for(const h of hexes){
  const v=uint64('0x'+h);
  const pats=[v,v.or(uint64('0x8000000000000000'))].map(x=>{const b=Memory.alloc(8);b.writeU64(x);return Array.from(new Uint8Array(b.readByteArray(8))).map(y=>('0'+y.toString(16)).slice(-2)).join(' ');});
  const hits=[];
  for(const r of Process.enumerateRanges('r--')){
   if(r.size>512*1024*1024)continue;
   for(const p of pats){let m=[];try{m=Memory.scanSync(r.base,r.size,p);}catch(e){continue;}
    for(const x of m.slice(0,4))hits.push({at:x.address.toString(),file:r.file?r.file.path.split('/').pop():null,prot:r.protection});}
   if(hits.length>24)break;
  }
  out[h]=hits;
 }
 return out;
}};
"""
# Lua error text prints a type nibble before the hash: #x4<16 hex digits>.
def norm(a):
    a=a.lower().removeprefix('#x')
    return a[1:] if len(a)==17 else a
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS);sc.load()
try:
    for h,hits in sc.exports_sync.scan([norm(a) for a in sys.argv[1:]]).items():
        print(h,len(hits),'hits')
        for x in hits[:12]:print('  ',x)
finally:
    sc.unload();s.detach()
