"""Inspect or register one existing weapon asset through original engine callback, on LUI frame."""
import pathlib,sys,subprocess,frida,threading,json
here=pathlib.Path(__file__).resolve().parent
ref=sys.argv[1] if len(sys.argv)>1 else 'iw9_ar_mike4_mp';apply='--apply' in sys.argv
js=(here/'lua_exec.js').read_text();a=js.index('  const buf=Memory.allocUtf8String(src);');z=js.index('  const s=tostr',a)
body=r'''
  out.countBefore=at(0x6cb1ab0).readU32();out.busy=at(0x6cb1abc).readU8();out.state=at(0x54bb7e8).readPointer().add(8).readU32();
  const ref=Memory.allocUtf8String(REF);
  const lookup=new NativeFunction(at(0x19a8d88),'pointer',['int','pointer','int']);
  const asset=lookup(60,ref,1);out.asset=asset.toString();
  if(asset.isNull())throw Error('weapon asset absent');
  out.header=Array.from(new Uint8Array(asset.readByteArray(48)));
  out.strings={};for(const o of [8,16,24]){try{out.strings[o]=asset.add(o).readPointer().readCString(100);}catch(e){}}
  if(APPLY){
   if(out.state>=5||out.busy!==0)throw Error('frontend guard rejected');
   if(at(0x28fe554).readU32()!==0xd101c3ff)throw Error('callback opcode mismatch');
   const register=new NativeFunction(at(0x28fe554),'void',['int','pointer']);register(0,ref);
   out.countAfter=at(0x6cb1ab0).readU32();out.busyAfter=at(0x6cb1abc).readU8();
  }
'''.replace('REF',json.dumps(ref)).replace('APPLY','true' if apply else 'false')
js=js[:a]+body+js[z:]
pid=int(subprocess.check_output(['adb','-s','PHONE_IP:5555','shell','pidof','com.activision.callofduty.warzone']).decode().strip());e=threading.Event()
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
def msg(m,d):
 print(m,flush=True)
 if m.get('payload',{}).get('kind')=='lua_result':e.set()
sc=s.create_script(js);sc.on('message',msg);sc.load()
try:sc.exports_sync.run('go');e.wait(15)
finally:sc.unload();s.detach()
