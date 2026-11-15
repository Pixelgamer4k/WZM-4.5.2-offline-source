#!/usr/bin/env python3
"""loc_hash.py <text>...: find localized strings in live memory and print the table record that points at each."""
import json,os,subprocess,sys,threading
import frida
threading.Timer(50,lambda:os._exit(3)).start()
JS=r"""
rpc.exports={find(t){
 const pat=Array.from(t).map(c=>c.charCodeAt(0)).map(x=>x.toString(16).padStart(2,'0')).join(' ');
 const hits=[];const ranges=Process.enumerateRanges('r--').filter(r=>r.size<0x8000000&&!(r.file&&/\.so|\.oat|\.apk|\.art|\.jar/.test(r.file.path)));
 for(const r of ranges){try{for(const m of Memory.scanSync(r.base,r.size,pat))hits.push(m.address);}catch(e){}}
 const out=[];
 for(const a of hits.slice(0,4)){
  const le=[];let v=uint64(a.toString());for(let i=0;i<8;i++){le.push(v.and(0xff).toNumber().toString(16).padStart(2,'0'));v=v.shr(8);}
  const p=le.join(' ');
  for(const r of ranges){try{for(const m of Memory.scanSync(r.base,r.size,p)){const b=Array.from(new Uint8Array(m.address.sub(0x18).readByteArray(0x30))).map(x=>x.toString(16).padStart(2,'0')).join('');out.push({str:a.toString(),ref:m.address.toString(),around:b});}}catch(e){}}
 }
 return{hits:hits.length,out:out.slice(0,6)};
}};
"""
pid=int(subprocess.check_output(['adb','-s','PHONE_IP:5555','shell','pidof','com.activision.callofduty.warzone']).split()[0])
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid);sc=s.create_script(JS);sc.load()
for t in sys.argv[1:]:print(t,json.dumps(sc.exports_sync.find(t)),flush=True)
os._exit(0)
