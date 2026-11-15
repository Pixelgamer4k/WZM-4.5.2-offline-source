"""Load exact archived current-build hub bytecode on the LUI frame; retain typed menu key."""
import pathlib,sys,threading,subprocess,json
import frida
here=pathlib.Path(__file__).resolve().parent
blob=(here.parents[1]/'frontend_offline_static_20261104/module_11d1836.ljbc').read_bytes()
js=(here/'lua_exec.js').read_text()
start=js.index('  const buf=Memory.allocUtf8String(src);')
end=js.index('  const s=tostr',start)
js=js[:start]+'''  const bytes=BYTES;
  const buf=Memory.alloc(bytes.length);buf.writeByteArray(bytes);
  out.load=load(L,buf,bytes.length,name,ptr(0));
  if(out.load===0){
    const arg="for k,v in pairs(MobileMainMenuButtons) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then return v.menuName end end error('missing gear key')";
    const ab=Memory.allocUtf8String(arg);
    out.argLoad=load(L,ab,arg.length,name,ptr(0));
    if(out.argLoad===0)out.argCall=pcall(L,0,1,0);
    if(out.argCall===0)out.pcall=pcall(L,1,1,0);
  }
'''.replace('BYTES',json.dumps(list(blob)))+js[end:]
pid=int(subprocess.check_output(['adb','-s','PHONE_IP:5555','shell','pidof','com.activision.callofduty.warzone']).decode().strip())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
e=threading.Event()
def msg(m,d):
 print(m,flush=True)
 if m.get('payload',{}).get('kind')=='lua_result':e.set()
sc=s.create_script(js);sc.on('message',msg);sc.load()
try:sc.exports_sync.run('go');e.wait(15)
finally:sc.unload();s.detach()
