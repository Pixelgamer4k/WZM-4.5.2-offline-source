"""Read-only bounded server-client and native-initializer-backed gclient snapshots."""
import sys,json,subprocess,frida,time,pathlib
from device_pid import resolve_game_pid
js=r'''
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
function read(fn){try{return fn();}catch(e){return {error:String(e)};}}
function hex(p,n){return Array.from(new Uint8Array(p.readByteArray(n)),x=>x.toString(16).padStart(2,'0')).join('');}
rpc.exports={snapshot(){return read(()=>{
 const count=at(0x54cafa8).readPointer().readS32(),slots=at(0x54cafb0).readPointer();
 const alloc=at(0x54bfb78).readPointer(),gbase=alloc.readPointer();
 const entityBase=read(()=>at(0x54beee0).readPointer().readPointer().add(0x18).readPointer());
 const rows=[];for(let i=0;i<Math.min(Math.max(count,0),20);i++){
 const c=slots.add(i*8).readPointer();if(c.isNull()||c.add(8).readU8()===0)continue;
 const g=gbase.add(i*0x31270),row={slot:i,serverClient:c.toString(),state:c.add(8).readU8(),botMarker:c.add(0xb668).readU32(),server280:c.add(0x280).readU8()};
 row.gameClient=read(()=>({address:g.toString(),field10:g.add(0x10).readU32(),field79b8:g.add(0x79b8).readU32(),field79bc:g.add(0x79bc).readU32(),team7f20:g.add(0x7f20).readU8(),prefixHex:hex(g,0x180)}));
 row.entity=read(()=>{const p=entityBase.add(i*0x6f0);return {address:p.toString(),client170:p.add(0x170).readPointer().toString(),info178:p.add(0x178).readPointer().toString(),headerHex:hex(p,0x200)}});
 rows.push(row);}
 return {pid:Process.id,timeMs:Date.now(),count,rows};
 });}};
'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());sc=s.create_script(js);sc.load()
try:
 for i in range(int(sys.argv[1]) if len(sys.argv)>1 else 1):
  print(json.dumps(sc.exports_sync.snapshot()),flush=True)
  if i+1<int(sys.argv[1] if len(sys.argv)>1 else 1):time.sleep(1)
finally:sc.unload();s.detach()
