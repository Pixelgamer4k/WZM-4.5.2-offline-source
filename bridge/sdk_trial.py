import os,subprocess,time,sys,json
from pathlib import Path
root=Path(os.environ.get('WZM_ROOT', '..'));bridge=root/'analysis/frida_tools/lua_bridge';r=root/'analysis/runtime/match_entry_20261102';tag='scale_bind_'+time.strftime('%H%M%S');log=r/(tag+'.log')
env=os.environ.copy()
for k in ['FAKE_PLAYER_DATA','VM53_STEER_PIN','FORCE_LOOPBACK','CL_RESEND','NULL_ENTITY_GUARD','ROUTE_LOCAL_HOST_PACKET','OBSERVE_CONNECT_ID','FORCE_OOB_CMD','SEND_GAMESTATE','QUIET','JOIN_ALLIES','MATCH_PROBE','UI_RETRY','LUA_ASSET_CACHE','UI_LOOKUP_TRACE','UI_MISSING_NIL']:env['WZM_'+k]='1'
env.update(WZM_MP_MODE='211',WZM_OMNVAR_ADD='0x750bd5872bb1d322',WZM_LUI_SEND='class_select:0@22000',WZM_MATCH_LUA_STEPS='17000:hitmarker_scale_state.lua,18000:hitmarker_scale_bind.lua,19000:aa_state.lua,25000:hitmarker_bind_state.lua,30000:hitmarker_bind_state.lua,45000:hitmarker_bind_state.lua')
print('trial',tag,flush=True)
with (r/(tag+'.console.txt')).open('w') as out:
 p=subprocess.Popen([str(bridge/'run_host.sh'),tag,'65','mp_mgl_nuketown','0x3f9bd6e4038d651d'],env=env,cwd=bridge,stdout=out,stderr=subprocess.STDOUT)
 watcher=None
 for _ in range(420):
  if log.exists() and 'clientEnterWorld' in log.read_text(errors='replace'):
   host_pid=next(json.loads(line)['pid'] for line in log.read_text().splitlines() if '"s": "attachedProcess"' in line)
   watcher=subprocess.Popen([str(root/'analysis/frida_venv/bin/python3'),'java_watch.py',(sys.argv[1] if len(sys.argv)>1 else 'sdk_entry.js'),'40',str(r/(tag+'.sdk.jsonl')),str(host_pid)],cwd=bridge,stdout=out,stderr=subprocess.STDOUT);print('observer attached',flush=True);break
  if p.poll() is not None:break
  time.sleep(1)
 if watcher:
  try:watcher.wait(timeout=50)
  except subprocess.TimeoutExpired:watcher.kill();watcher.wait()
 try:p.wait(timeout=100)
 except subprocess.TimeoutExpired:p.terminate()
print('finished',tag,flush=True)
