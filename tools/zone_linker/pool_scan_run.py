import frida,subprocess,sys,time,json,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p));res=[]
sc=s.create_script(open(pathlib.Path(__file__).parent/'pool_scan.js').read());sc.on('message',lambda m,d:res.append(m.get('payload',m)));sc.load()
t=time.time()
while not res and time.time()-t<240:time.sleep(1)
out=pathlib.Path('pool');out.mkdir(exist_ok=True);(out/'scan.json').write_text(json.dumps(res))
for r in res:
    if isinstance(r,dict) and r.get('s')=='poolScan':
        print('ranges',r['n'])
        for x in r['top'][:15]:print(x['base'],x['size']>>20,'MB',x['prot'],x['path'][-40:],'tight',x['tight'],'frac',x['frac'])
    else:print(r)
