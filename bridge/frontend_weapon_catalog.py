"""Populate frontend registry from active, resident DB weapon assets via original callback.
No asset edits or synthetic readiness/count writes. --apply opts into original registrations.
"""
import frida,subprocess,pathlib,threading,json,sys
apply='--apply' in sys.argv
js=r'''
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x),p=at(0x635b940+60*0xd0);
const base=p.readPointer(),stride=p.add(20).readU32(),capacity=p.add(16).readU32(),bits=p.add(0xb0).readPointer();
if(stride!==0x530||capacity>2048)throw Error('pool layout mismatch');
const refs=[];for(let i=0;i<capacity;i++){if(!(bits.add((i>>>5)*4).readU32()&(0x80000000>>>(i&31))))continue;
 const asset=base.add(i*stride);try{const name=asset.add(8).readPointer().readUtf8String();if(name&&/^[a-zA-Z0-9_]{1,120}$/.test(name))refs.push({index:i,name,asset:asset.toString()});}catch(e){send({kind:'bad_asset',index:i,error:String(e)});}}
send({kind:'catalog',capacity,stride,refs,countBefore:at(0x6cb1ab0).readU32()});
if(APPLY){
 if(at(0x28fe554).readU32()!==0xd101c3ff)throw Error('callback opcode mismatch');
 const register=new NativeFunction(at(0x28fe554),'void',['int','pointer']);let pos=0,ended=false;
 const strings=refs.map(r=>Memory.allocUtf8String(r.name));
 Interceptor.attach(at(0x337c1c0),{onEnter(){if(ended)return;
  try{
   const st=at(0x54bb7e8).readPointer().add(8).readU32();
   if(st>=5||at(0x6cb1abc).readU8()!==0)throw Error('frontend guard rejected');
   for(let j=0;j<4&&pos<refs.length;j++,pos++)register(pos+1,strings[pos]);
   if(pos%40===0)send({kind:'progress',processed:pos,count:at(0x6cb1ab0).readU32()});
   if(pos===refs.length){ended=true;send({kind:'done',processed:pos,count:at(0x6cb1ab0).readU32(),busy:at(0x6cb1abc).readU8()});}
  }catch(e){ended=true;send({kind:'done',error:String(e),processed:pos});}
 }});
}
'''.replace('APPLY','true' if apply else 'false')
pid=int(subprocess.check_output(['adb','-s','PHONE_IP:5555','shell','pidof','com.activision.callofduty.warzone']).decode().strip())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid);e=threading.Event();result={}
def msg(m,d):
 print(json.dumps(m),flush=True)
 if m.get('type')=='error':result['error']=m.get('description','agent error');e.set()
 if m.get('payload',{}).get('kind')=='done':result.update(m['payload']);e.set()
sc=s.create_script(js);sc.on('message',msg);sc.load()
try:
 if apply:e.wait(45)
finally:sc.unload();s.detach()
if apply and (result.get('error') or result.get('count',0)<1 or result.get('busy')!=0):
 sys.exit('Registration failed or timed out: '+json.dumps(result))
