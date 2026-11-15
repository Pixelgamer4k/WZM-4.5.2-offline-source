"""Read loaded native customization IDs and original cyclic bot appearance pool."""
import frida,json
from device_pid import resolve_game_pid
js=r'''
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
function group(start,count){const first=at(start).readU16(),n=at(count).readU32();if(n>10000)throw Error('registry bound');const rows=[];for(let i=0;i<n;i++){const e=at(0x6b298f8).add((first+i)*32);rows.push({index:first+i,id:e.add(0x12).readU16(),compat:e.add(0x14).readU32(),hash:e.readU64().toString(16),hash2:e.add(8).readU64().toString(16),linkedHead:e.add(0x18).readU16(),flags1c:e.add(0x1c).readU8(),flags1d:e.add(0x1d).readU8(),unavailable:e.add(0x1e).readU8()});}return rows;}
rpc.exports={snapshot(){const pool=at(0xce0c2c0),n=pool.add(0x1620).readU32();if(n>200)throw Error('pool bound');const rows=[];for(let i=0;i<n;i++)rows.push(Array.from(new Uint8Array(pool.add(0x3c+i*28).readByteArray(28))));return {pid:Process.id,heads:group(0x6b99e90,0x6b99e94),bodies:group(0x6b99ea0,0x6b99ea4),pool:{cursor:pool.add(0x161c).readU32(),count:n,rows}};}};
'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());sc=s.create_script(js);sc.load()
try: print(json.dumps(sc.exports_sync.snapshot()),flush=True)
finally:sc.unload();s.detach()
