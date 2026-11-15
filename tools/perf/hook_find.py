#!/usr/bin/env python3
"""Diff in-memory libgame code against input/libgame.so to list every patched/hooked address (read-only)."""
import sys,struct,subprocess,pathlib,json
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
ROOT=pathlib.Path(__file__).resolve().parents[2]
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode().split()[0])
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(open(pathlib.Path(__file__).with_name('hook_find.js')).read());sc.load();E=sc.exports_sync
lib=open(ROOT/'input/libgame.so','rb').read()
# map file offsets for executable PT_LOAD segments
phoff=struct.unpack_from('<Q',lib,0x20)[0];phn=struct.unpack_from('<H',lib,0x38)[0];segs=[]
for i in range(phn):
    t,fl,off,va,pa,fs,ms,al=struct.unpack_from('<IIQQQQQQ',lib,phoff+i*56)
    if t==1 and fl&1: segs.append((va,off,fs))
def fileat(va,n):
    for sva,off,fs in segs:
        if sva<=va<sva+fs: return lib[off+va-sva:off+va-sva+n]
    return None
R=E.ranges('libgame.so');patched=[]
for off,size in R['r']:
    off=int(off,16);size-=size%4096;sums=E.sums('libgame.so',off,size)
    for i in range(size//4096):
        va=off+i*4096;fb=fileat(va,4096)
        if fb is None: continue
        sm=1469598103934665603
        for (w,) in struct.iter_unpack('<I',fb): sm^=w;sm=(sm*1099511628211)&0xFFFFFFFFFFFFFFFF
        if struct.unpack_from('<Q',sums,i*8)[0]!=sm:
            mem=E.read('libgame.so',va,4096)
            j=0
            while j<4096:
                if mem[j:j+4]!=fb[j:j+4]:
                    k=j
                    while k<4096 and mem[k:k+4]!=fb[k:k+4]: k+=4
                    patched.append((va+j,k-j,mem[j:j+min(16,k-j)].hex()));j=k
                else: j+=4
print(json.dumps([(hex(a),n,h) for a,n,h in patched]))
