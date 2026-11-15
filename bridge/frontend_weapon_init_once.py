"""Explicit one-shot frontend weapon lifecycle test, on game thread, only with empty registry."""
import pathlib,threading,subprocess,frida
here=pathlib.Path(__file__).resolve().parent
js=(here/'lua_exec.js').read_text()
a=js.index('  const buf=Memory.allocUtf8String(src);');z=js.index('  const s=tostr',a)
js=js[:a]+'''  out.countBefore=at(0x6cb1ab0).readU32();out.busy=at(0x6cb1abc).readU8();
  out.modeGuard=at(0x54caf08).readPointer().readU32();
  out.clientState=at(0x54bb7e8).readPointer().add(8).readU32();
  if(at(0x28fe324).readU32()!==0xd10383ff)throw Error('opcode mismatch');
  if(out.countBefore!==0||out.busy!==0||out.modeGuard!==0||out.clientState>=5)throw Error('frontend guard rejected');
  const init=new NativeFunction(at(0x28fe324),'int',['int']);
  out.initResult=init(0);out.countAfter=at(0x6cb1ab0).readU32();out.busyAfter=at(0x6cb1abc).readU8();
'''+js[z:]
pid=int(subprocess.check_output(['adb','-s','PHONE_IP:5555','shell','pidof','com.activision.callofduty.warzone']).decode().strip())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid);e=threading.Event()
def msg(m,d):
 print(m,flush=True)
 if m.get('payload',{}).get('kind')=='lua_result':e.set()
sc=s.create_script(js);sc.on('message',msg);sc.load()
try:sc.exports_sync.run('go');e.wait(15)
finally:sc.unload();s.detach()
