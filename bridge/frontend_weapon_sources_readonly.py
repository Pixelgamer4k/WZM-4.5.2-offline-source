import frida,subprocess,json
pid=int(subprocess.check_output(['adb','-s','PHONE_IP:5555','shell','pidof','com.activision.callofduty.warzone']).decode().strip())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
js=r'''
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);const out={count:at(0x6cb1ab0).readU32(),lists:[],pools:[]};
let n=at(0xb235960+14*24).readPointer();for(let i=0;i<20&&!n.isNull();i++){let h=n.readPointer();let x={node:n.toString(),head:h.toString(),header:Array.from(new Uint8Array(h.readByteArray(48))),kind:h.add(8).readU32(),subkind:h.add(12).readU8(),count:h.add(20).readU32(),refs:[]};let arr=h.add(32).readPointer();for(let k=0;k<Math.min(x.count,5);k++){try{x.refs.push(arr.add(k*8).readPointer().readCString(120));}catch(e){x.refs.push(String(e));}}out.lists.push(x);n=n.add(8).readPointer();}
for(const type of [59,60,75,114,162]){let p=at(0x635b940+type*0xd0);out.pools.push({type,header:Array.from(new Uint8Array(p.readByteArray(0xd0)))});}send(out);
'''
a=s.create_script(js);a.on('message',lambda m,d:print(json.dumps(m)));a.load();a.unload();s.detach()
