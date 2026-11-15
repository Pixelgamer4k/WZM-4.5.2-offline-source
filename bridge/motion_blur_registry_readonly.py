"""Bounded read-only module lookup of particle InitMotionBlur metadata pointers."""
import frida,json
from device_pid import resolve_game_pid
js=r'''
const m=Process.getModuleByName('libgame.so'),b=m.base;rpc.exports={snapshot(){const out=[];let scanned=0;const low=b,high=b.add(m.size);for(const r of Process.enumerateRanges('rw-')){const lo=r.base.compare(low)>0?r.base:low,hi=r.base.add(r.size).compare(high)<0?r.base.add(r.size):high;if(lo.compare(hi)>=0)continue;const n=hi.sub(lo).toInt32();if(n<0||scanned+n>192*1024*1024)continue;scanned+=n;for(const[nm,off]of[['InitMotionBlur',0x4b17cc],['SetBlurStrength',0x419b36]]){const p=b.add(off),pattern=p.toString().slice(2).padStart(16,'0').match(/../g).reverse().join(' ');for(const hit of Memory.scanSync(lo,n,pattern)){const row={name:nm,rva:hit.address.sub(b).toString(),neighbors:[]};for(let k=-16;k<32;k+=8){try{const v=hit.address.add(k).readPointer();row.neighbors.push({offset:k,value:v.toString(),moduleRva:v.compare(b)>=0&&v.compare(high)<0?v.sub(b).toString():null});}catch(e){}}out.push(row);}}}return {pid:Process.id,moduleSize:m.size,scannedBytes:scanned,hits:out};}};
'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());j=s.create_script(js);j.load()
try:print(json.dumps(j.exports_sync.snapshot()),flush=True)
finally:j.unload();s.detach()
