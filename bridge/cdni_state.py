#!/usr/bin/env python3
"""cdni_state.py [seconds]: report which CDNI install states the engine ticks through."""
import pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
NAMES='InitialState CacheValidation CheckNetworkConnection CheckDevNetwork FetchingEnvironmentConfig RequestManifest FetchingManifest ManifestOk FetchingPreloadManifest UpdateFileDb RecoverBackupShards PrepareDownload CalculateUpdateSize FreeDiskSpace CheckDiskSpace QosTest StartDownload Downloading RegisterShards DownloadComplete FinalizeFileSystemDB GarbageCollection ExitInstallStage EnterFrontEnd Idle ProcessOptionalDownload CheckOptionalProgressRecords OptionalDownloading Placeholder_0 WaitUserInput UnrecoverablePrompt CellularDownloadChecking CellularOptionalDownloadChecking WaitDevVerifyCache'.split()
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
JS="""
const b=Process.getModuleByName('libgame.so').base;let last=-2;
Interceptor.attach(b.add(0x12c6200),{onEnter(a){const s=a[1].toInt32();if(s!==last){last=s;send(s);}}});
"""
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS)
t0=time.time()
def msg(m,_):
    if m['type']=='send':n=m['payload'];print(f"t={time.time()-t0:.1f}",n,NAMES[n] if 0<=n<len(NAMES) else '?',flush=True)
    else:print(m)
sc.on('message',msg);sc.load();time.sleep(float(sys.argv[1]) if len(sys.argv)>1 else 4);sc.unload();s.detach();print('done')
