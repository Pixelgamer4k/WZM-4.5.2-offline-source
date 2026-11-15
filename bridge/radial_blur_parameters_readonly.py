"""Read renderer-backed radial blur dvar types, domains and defaults."""
import frida,json
from device_pid import resolve_game_pid
js=r'''
const b=Process.getModuleByName('libgame.so').base;rpc.exports={snapshot(){return [0x54d3598,0x54d35a0,0x54d35a8,0x54d35b0,0x54d35b8,0x54d35c0,0x54d35c8,0x54d35d0].map(rva=>{try{const p=b.add(rva).readPointer().readPointer();return {rva:'0x'+rva.toString(16),ptr:p.toString(),hash:p.readU64().toString(16),type:p.add(0x15).readU8(),current:Array.from({length:4},(_,i)=>p.add(0x28+i*4).readFloat()),default:Array.from({length:4},(_,i)=>p.add(0x48+i*4).readFloat()),domain:[p.add(0x18).readFloat(),p.add(0x1c).readFloat()]};}catch(e){return {rva,error:String(e)};}});}};
'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());j=s.create_script(js);j.load()
try:print(json.dumps(j.exports_sync.snapshot()),flush=True)
finally:j.unload();s.detach()
