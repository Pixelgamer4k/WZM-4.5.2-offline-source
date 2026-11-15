import frida,subprocess,sys,time,json,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
src=open(pathlib.Path(__file__).parent/'pool_scan.js').read().replace("send({ s: 'poolScan'","globalThis.RES=res;send({ s: 'poolScan'")
src=src.replace("rpc.exports = {","rpc.exports = { pages(base,size){ const o=Memory.alloc(4*65536); const c=scan(ptr(base),size,o,65536); const idx=Array.from(new Uint32Array(o.readByteArray(4*Math.min(c,65536)))); const buf=new Uint8Array(idx.length*1024); idx.forEach((pi,i)=>buf.set(new Uint8Array(ptr(base).add(pi*1024).readByteArray(1024)),i*1024)); return buf.buffer; },")
res=[];sc=s.create_script(src);sc.on('message',lambda m,d:res.append(m.get('payload',m)));sc.load()
while not res:time.sleep(1)
top=res[0]['top'][:10];out=pathlib.Path('pool');out.mkdir(exist_ok=True)
for x in top:
    data=sc.exports_sync.pages(x['base'],x['size'])
    (out/f"tight_{x['base']}.bin").write_bytes(data);print(x['base'],x['size']>>20,'MB',len(data)//1024,'pages',x['path'][-20:])
