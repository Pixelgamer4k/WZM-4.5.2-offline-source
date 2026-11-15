"""Inspect actual radial-blur dvar reached by original settings builder2d97918."""
import frida,json,sys
from device_pid import resolve_game_pid
js=r'''
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
function snapshot(){const global=at(0x54d4d48).readPointer(),p=global.readPointer(),type=p.add(0x15).readU8();return {pid:Process.id,global:global.toString(),pointer:p.toString(),hash:p.readU64().toString(16),type,current:p.add(0x28).readU32(),latched:p.add(0x38).readU32(),default:p.add(0x48).readU32(),flags:p.add(0x10).readU32(),activeShaderValue:at(0x835ede4).readU32()};}
rpc.exports={snapshot};
'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());j=s.create_script(js);j.load()
try:print(json.dumps(j.exports_sync.snapshot()),flush=True)
finally:j.unload();s.detach()
