"""Inspect Off/Spatial/Temporal enum and its native global references without writes."""
import frida,json
from pathlib import Path
from device_pid import resolve_game_pid
js=Path(__file__).with_name('gfx_set.js').read_text()+r'''
rpc.exports={probe(){const p=idx['5cd1f66da730bbca'];if(!p)throw Error('enum absent');const n=p.add(0x18).readU32(),a=p.add(0x20).readPointer(),labels=[];if(n>20)throw Error('enum domain bound');for(let i=0;i<n;i++)labels.push(a.add(i*8).readPointer().readCString());const bytes=p.toString().slice(2).padStart(16,'0').match(/../g).reverse();const low=b.add(0x54b0000),high=b.add(0x8400000),refs=[];for(const r of Process.enumerateRanges('rw-')){let lo=r.base.compare(low)>0?r.base:low,hi=r.base.add(r.size).compare(high)<0?r.base.add(r.size):high;if(lo.compare(hi)>=0)continue;for(const m of Memory.scanSync(lo,hi.sub(lo).toInt32(),bytes.join(' ')))refs.push(m.address.sub(b).toString());}return {pid:Process.id,pointer:p.toString(),current:p.add(0x28).readS32(),default:p.add(0x48).readS32(),type:p.add(0x15).readU8(),labels,globalRefs:refs};}};
'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());j=s.create_script(js);j.load()
try:print(json.dumps(j.exports_sync.probe()),flush=True)
finally:j.unload();s.detach()
