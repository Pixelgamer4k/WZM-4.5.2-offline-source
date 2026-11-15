#!/usr/bin/env python3
"""Read existing native command registrations without running commands."""
import argparse,json,re,subprocess
from pathlib import Path
import frida

def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--device',default='PHONE_IP:5555')
 ap.add_argument('--output',required=True,type=Path)
 args=ap.parse_args()
 if args.output.exists():ap.error('choose a fresh output filename')
 def adb(*a):return subprocess.check_output(['adb','-s',args.device,*a],timeout=10).decode().strip()
 meta=adb('shell','dumpsys','package','com.activision.callofduty.warzone')
 if not re.search(r'versionCode=3953\b',meta):raise RuntimeError('unsupported version')
 pid=adb('shell','pidof','com.activision.callofduty.warzone')
 if not pid.isdecimal():raise RuntimeError('one running game process required')
 adb('forward','tcp:27042','tcp:27042')
 session=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(pid))
 script=session.create_script(Path(__file__).with_name('command_registry_readonly.js').read_text())
 try:
  script.load();result=script.exports_sync.capture(False);result['pid']=int(pid)
  result['secondary']=script.exports_sync.capture(True)
  result['matchmakingState']=script.exports_sync.matchmaking_state()
 finally:
  script.unload();session.detach()
 if adb('shell','pidof','com.activision.callofduty.warzone')!=pid:raise RuntimeError('PID changed during capture')
 args.output.parent.mkdir(parents=True,exist_ok=True)
 with args.output.open('x') as f:json.dump(result,f,indent=2)
 print(json.dumps({**{k:v for k,v in result.items() if k not in ('records','secondary')},'selected':[r for r in result['records']+result['secondary']['records'] if re.search('match|server|party|tutorial|practice|devmap',r.get('name') or '',re.I)]},indent=2))
if __name__=='__main__':main()
