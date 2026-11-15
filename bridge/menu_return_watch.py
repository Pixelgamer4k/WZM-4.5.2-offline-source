#!/usr/bin/env python3
"""menu_return_watch.py <host log> [seconds]

"Main Menu" on the Match Summary sends the game back to the front end, which runs
the online "fence" checks again. The boot script's skip (watch.js +
skip_online_fences.lua) is no longer loaded by then, so the menu waits forever on a
black screen. This attaches to the hosted game, waits for the client to disconnect
after the match, and loads that skip again (verified 4 Nov: black -> main menu).
It also patches a relaunched game process the same way, in case one appears.
"""
import json,pathlib,subprocess,sys,time
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
here=pathlib.Path(__file__).parent
log=pathlib.Path(sys.argv[1]);deadline=time.time()+float(sys.argv[2] if len(sys.argv)>2 else 3600)
def say(**k):print(json.dumps(k),flush=True)
def pids():
    o=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()
    return {int(x) for x in o if x.isdecimal()}
# 1. wait until the hosted match is running, then remember its process
start_by=time.time()+420
while True:
    if log.exists() and '"clientEnterWorld"' in log.read_text(errors='replace'):break
    if time.time()>start_by:say(s='menuWatchNoMatch');sys.exit(0)  # launch failed/retried
    time.sleep(2)
known=pids();say(s='menuWatchArmed',known=sorted(known))
dev=frida.get_device_manager().add_remote_device('127.0.0.1:27042')
fences=(here/'skip_online_fences.lua').read_text();agent=(here/'watch.js').read_text()
MON="""
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);let was=0,sent=false;
Interceptor.attach(at(0x337c1c0),{onEnter(){if(sent)return;let st=0;try{st=at(0x54bb7e8).readPointer().add(8).readU32();}catch(e){return;}
 if(st>=7)was=st;else if(was>=7&&st<5){sent=true;send({s:'menuMatchLeft',from:was,to:st});}}});
"""
def load_skip(sess,pid):
    sc=sess.create_script(agent)
    sc.on('message',lambda m,_:print(json.dumps({'pid':pid,**(m.get('payload') if isinstance(m.get('payload'),dict) else {'m':m})})[:300],flush=True))
    sc.load();sc.exports_sync.start(fences);say(s='menuPatchApplied',pid=pid);return sc
hosted=sorted(known)[-1] if known else None
hsess=None;left=[]
if hosted:
    try:
        hsess=dev.attach(hosted);mon=hsess.create_script(MON)
        mon.on('message',lambda m,_:left.append(m.get('payload')));mon.load();say(s='menuMonitorArmed',pid=hosted)
    except Exception as e:say(s='menuMonitorError',e=str(e)[:200])
skip_scripts=[]
while time.time()<deadline:
    if left and hsess and not skip_scripts:
        say(s='menuMatchLeft',info=left[0])
        try:skip_scripts.append(load_skip(hsess,hosted))
        except Exception as e:say(s='menuPatchError',pid=hosted,e=str(e)[:200])
    new=sorted(pids()-known)
    if not new:time.sleep(1);continue
    pid=new[-1];known.add(pid);say(s='menuRelaunchSeen',pid=pid,t=time.strftime('%H:%M:%S'))
    # same pacing as boot_offline.sh: early attach makes startup stall, so let it get going first
    time.sleep(12)
    try:
        sess=dev.attach(pid)
        for _ in range(120):
            probe=sess.create_script("send(Process.findModuleByName('libgame.so')!==null)");r=[]
            probe.on('message',lambda m,_:r.append(m.get('payload')));probe.load();probe.unload()
            if r and r[0]:break
            time.sleep(0.5)
        sc=sess.create_script(agent)
        sc.on('message',lambda m,_:print(json.dumps({'pid':pid,**(m.get('payload') if isinstance(m.get('payload'),dict) else {'m':m})})[:300],flush=True))
        sc.load();sc.exports_sync.start(fences);say(s='menuPatchApplied',pid=pid)
        while time.time()<deadline and not sess.is_detached and pid in pids():time.sleep(2)
        say(s='menuProcessGone',pid=pid)
    except Exception as e:
        say(s='menuPatchError',pid=pid,e=str(e)[:200])
