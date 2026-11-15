"""Inspect renderer mode policy's original neighboring dvars, read-only."""
import frida,json
from device_pid import resolve_game_pid
js=r'''const b=Process.getModuleByName('libgame.so').base;rpc.exports={snapshot(){return [0x54d4140,0x54d4148,0x54d4170,0x54d37c0,0x54d3ac8].map(rva=>{try{const p=b.add(rva).readPointer().readPointer(),type=p.add(0x15).readU8(),o={rva:'0x'+rva.toString(16),hash:p.readU64().toString(16),type,current:p.add(0x28).readU32(),default:p.add(0x48).readU32()};if(type===9){const n=p.add(0x18).readU32(),s=p.add(0x20).readPointer();if(n>32)throw Error('enum bound');o.labels=Array.from({length:n},(_,i)=>s.add(i*8).readPointer().readCString());}return o;}catch(e){return{rva,error:String(e)};}});}};'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());j=s.create_script(js);j.load()
try:print(json.dumps(j.exports_sync.snapshot()),flush=True)
finally:j.unload();s.detach()
