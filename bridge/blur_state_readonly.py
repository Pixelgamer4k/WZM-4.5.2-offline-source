"""Read-only evidence: the old alleged blur globals contain relocated name pointers."""
import frida,json
from device_pid import resolve_game_pid
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
js=r'''const b=Process.getModuleByName('libgame.so').base;rpc.exports={snapshot(){return {pid:Process.id,rows:[0x538ea30,0x538ea38,0x538ea48,0x5391a20,0x5391a28,0x5391a38].map(rva=>{const p=b.add(rva),v=p.readPointer();return {rva:'0x'+rva.toString(16),pointer:v.toString(),targetRva:v.sub(b).toString(),text:v.readCString()};})};}};'''
j=s.create_script(js);j.load()
try:print(json.dumps(j.exports_sync.snapshot()),flush=True)
finally:j.unload();s.detach()
