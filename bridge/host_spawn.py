#!/usr/bin/env python3
"""host_spawn.py <seconds> <map> <gametype hash> <log>: run host_spawn.js on the running game, then hard exit."""
import json,os,subprocess,sys,threading,time
import frida
secs=float(sys.argv[1]);m=sys.argv[2];g=sys.argv[3];out=open(sys.argv[4],'w')
threading.Timer(secs+20,lambda:os._exit(3)).start()
deferred_lifecycle=os.environ.get('WZM_LIFECYCLE_ON_VM53') == '1'
vm53_observed=threading.Event()
lifecycle_scripts=[]
write_lock=threading.Lock()
def install_deferred_lifecycle():
 try:
  # A Java bridge hook installed before host startup changed the path in
  # host21/host26. Attach only AFTER the original protected VM53 is reached.
  path=os.path.join(os.path.dirname(os.path.abspath(__file__)),'activity_lifecycle_probe.bundle.js')
  script=s.create_script(open(path).read())
  script.on('message',lambda x,_:w(x.get('payload',x)))
  script.load()
  lifecycle_scripts.append(script)
  w({'s':'lifecycleProbeAttachedAfterVM53','pid':pid})
 except Exception as e:
  w({'s':'lifecycleProbeDeferredError','error':str(e)[:300]})
def w(o):
 if isinstance(o,dict):
  o=dict(o)
  o.setdefault('captureEpochMs',int(time.time()*1000))
 t=json.dumps(o)
 # Preserve parseable evidence on disk; truncate only the console preview.
 with write_lock:
  print(t[:900],flush=True);out.write(t+'\n');out.flush()
 if deferred_lifecycle and isinstance(o,dict) and o.get('s')=='actualProtectedWrapperEnter' and o.get('idx')==53 and not vm53_observed.is_set():
  vm53_observed.set()
  threading.Thread(target=install_deferred_lifecycle,daemon=True).start()
from device_pid import resolve_game_pid
pid=resolve_game_pid()
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
w({'s':'attachedProcess','pid':pid})
if os.environ.get('WZM_LIFECYCLE_TRACE') == '1':
 lifecycle_path=os.path.join(os.path.dirname(os.path.abspath(__file__)),'activity_lifecycle_probe.bundle.js')
 lifecycle=s.create_script(open(lifecycle_path).read())
 lifecycle.on('message',lambda x,_:w(x.get('payload',x)))
 lifecycle.load()
 time.sleep(2)
 w({'s':'lifecycleProbeAttached','pid':pid})
source=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'host_spawn.js')).read()
if os.environ.get('WZM_GAMESTATE_RETRY') == '1':
 assert 'const GAMESTATE_RETRY = false;' in source
 source=source.replace('const GAMESTATE_RETRY = false;', 'const GAMESTATE_RETRY = true;',1)
if os.environ.get('WZM_NATIVE_BOT_CONNECT') == '1':
 assert os.environ.get('WZM_NATIVE_BOT_ONCE') != '1', 'choose one bot creation experiment'
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'native_bot_connect_once.js')).read()
if os.environ.get('WZM_NATIVE_BOT_ONCE') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'native_bot_once.js')).read()
if os.environ.get('WZM_TEAM_SELECT_TRACE') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'team_select_trace.js')).read()
if os.environ.get('WZM_SERVER_CMD_TRACE') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server_cmd_trace.js')).read()
if os.environ.get('WZM_LUI_SEND'):
 assert os.environ.get('WZM_TEAM_SELECT_CLIENT') != '1', 'WZM_LUI_SEND and WZM_TEAM_SELECT_CLIENT both patch the UI frame call'
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lui_send.js')).read().replace('__LUI_SEND_SPEC__', os.environ['WZM_LUI_SEND'])
if os.environ.get('WZM_TEAM_SELECT_CLIENT') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'team_select_client.js')).read()
if os.environ.get('WZM_CAMERA_OVERLAY_DIAGNOSTIC') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'camera_overlay_diagnostic.js')).read()
if os.environ.get('WZM_ROUTE_LOCAL_HOST_PACKET') == '1':
 source=source.replace('const ROUTE_LOCAL_HOST_PACKET = false;', 'const ROUTE_LOCAL_HOST_PACKET = true;',1)
 w({'s':'localHostPacketRoutingEnabled'})
if os.environ.get('WZM_SKIP_STUB53') == '1':
 assert 'const BYPASS_STUB53 = false;' in source
 source=source.replace('const BYPASS_STUB53 = false;', 'const BYPASS_STUB53 = true;', 1)
 w({'s':'diagnosticOnly','bypassStub53':True})
if os.environ.get('WZM_SKIP_STUB60') == '1':
 assert 'const BYPASS_STUB60 = false;' in source
 source=source.replace('const BYPASS_STUB60 = false;', 'const BYPASS_STUB60 = true;', 1)
 w({'s':'diagnosticOnly','bypassStub60':True})
if os.environ.get('WZM_ALT_PRODUCER') == '1':
 assert 'const USE_ORIGINAL_ALT_PRODUCER = false;' in source
 source=source.replace('const USE_ORIGINAL_ALT_PRODUCER = false;', 'const USE_ORIGINAL_ALT_PRODUCER = true;', 1)
 w({'s':'diagnosticOnly','originalAltProducer':True})
if os.environ.get('WZM_VM_WRAPPER_OBSERVE') == '1':
 assert 'const OBSERVE_PROTECTED_WRAPPERS = false;' in source
 source=source.replace('const OBSERVE_PROTECTED_WRAPPERS = false;', 'const OBSERVE_PROTECTED_WRAPPERS = true;', 1)
 w({'s':'readOnlyProtectedWrapperObserver','enabled':True})
if os.environ.get('WZM_VM53_STAGE_TRACE') == '1':
 assert os.environ.get('WZM_VM_WRAPPER_OBSERVE') == '1', 'VM53 stage tracing needs wrapper observation'
 assert 'const OBSERVE_VM53_STAGES = false;' in source
 source=source.replace('const OBSERVE_VM53_STAGES = false;', 'const OBSERVE_VM53_STAGES = true;', 1)
 w({'s':'readOnlyVM53StageTrace','enabled':True})
if os.environ.get('WZM_VM53_OBJECT_WATCH') == '1':
 assert os.environ.get('WZM_VM53_STAGE_TRACE') == '1', 'VM53 object watch needs stage tracing'
 assert 'const OBSERVE_VM53_OBJECT_DIFFS = false;' in source
 source=source.replace('const OBSERVE_VM53_OBJECT_DIFFS = false;', 'const OBSERVE_VM53_OBJECT_DIFFS = true;', 1)
 w({'s':'readOnlyVM53ObjectWatch','enabled':True,'size':224})
if os.environ.get('WZM_VM53_BRANCH_TRACE') == '1':
 assert os.environ.get('WZM_VM53_STAGE_TRACE') == '1', 'VM53 branch probe requires stage trace'
 assert 'const OBSERVE_VM53_BRANCHES = false;' in source
 source=source.replace('const OBSERVE_VM53_BRANCHES = false;', 'const OBSERVE_VM53_BRANCHES = true;',1)
 w({'s':'readOnlyVM53BranchProbe','enabled':True})
if os.environ.get('WZM_SESSION_FRAME_TRACE') == '1':
 assert 'const OBSERVE_SESSION_FRAMES = false;' in source
 source=source.replace('const OBSERVE_SESSION_FRAMES = false;', 'const OBSERVE_SESSION_FRAMES = true;',1)
 w({'s':'readOnlyOriginalSessionFrameTrace','enabled':True})
if os.environ.get('WZM_VM53_STRLEN_TRACE') == '1':
 assert os.environ.get('WZM_VM_WRAPPER_OBSERVE') == '1', 'VM53 strlen probe requires wrapper observation'
 assert 'const OBSERVE_VM53_STRLEN = false;' in source
 source=source.replace('const OBSERVE_VM53_STRLEN = false;', 'const OBSERVE_VM53_STRLEN = true;',1)
 w({'s':'readOnlyVM53StrlenProbe','enabled':True})
if os.environ.get('WZM_VM53_LIBC_TRACE') == '1':
 assert os.environ.get('WZM_VM_WRAPPER_OBSERVE') == '1', 'VM53 libc observer requires wrapper observation'
 assert 'const OBSERVE_VM53_LIBC_IO = false;' in source
 source=source.replace('const OBSERVE_VM53_LIBC_IO = false;', 'const OBSERVE_VM53_LIBC_IO = true;',1)
 w({'s':'readOnlyVM53LibcIO','enabled':True})
if os.environ.get('WZM_VM53_ABORT_TRACE') == '1':
 assert os.environ.get('WZM_VM_WRAPPER_OBSERVE') == '1', 'VM53 abort path trace requires wrapper observation'
 assert 'const OBSERVE_VM53_ABORT_BRANCH = false;' in source
 source=source.replace('const OBSERVE_VM53_ABORT_BRANCH = false;', 'const OBSERVE_VM53_ABORT_BRANCH = true;',1)
 w({'s':'readOnlyVM53AbortBranchTrace','enabled':True})
if os.environ.get('WZM_VM53_LATE_CALLS') == '1':
 assert os.environ.get('WZM_VM_WRAPPER_OBSERVE') == '1', 'VM53 late-call probe requires original wrapper observer'
 assert 'const OBSERVE_VM53_LATE_CALLS = false;' in source
 source=source.replace('const OBSERVE_VM53_LATE_CALLS = false;', 'const OBSERVE_VM53_LATE_CALLS = true;',1)
 w({'s':'readOnlyVM53LateNativeCalls','enabled':True,'sites':['0x29f9fc','0x29fa00','0x2a7428','0x2a742c']})
if os.environ.get('WZM_FINISH_TRACE') == '1':
 finish_bundle=os.path.join(os.path.dirname(os.path.abspath(__file__)),'finish_path_probe.bundle.js')
 finish_probe=s.create_script(open(finish_bundle).read())
 finish_probe.on('message',lambda x,_:w(x.get('payload',x)))
 finish_probe.load()
 time.sleep(2)
 w({'s':'readOnlyFinishPathTrace','enabled':True,'bundle':os.path.basename(finish_bundle)})
if os.environ.get('WZM_NET_IO') == '1':
 assert 'const OBSERVE_NET_IO = false;' in source
 source=source.replace('const OBSERVE_NET_IO = false;', 'const OBSERVE_NET_IO = true;',1)
 w({'s':'readOnlyNetIO','enabled':True})
if os.environ.get('WZM_BLOCK_TELEMETRY') == '1':
 assert 'const BLOCK_TELEMETRY_DNS = false;' in source
 source=source.replace('const BLOCK_TELEMETRY_DNS = false;', 'const BLOCK_TELEMETRY_DNS = true;',1)
 w({'s':'telemetryDnsBlockedInMemory','enabled':True})
if os.environ.get('WZM_JNI_FINISH') == '1':
 assert 'const OBSERVE_JNI_FINISH = false;' in source
 source=source.replace('const OBSERVE_JNI_FINISH = false;', 'const OBSERVE_JNI_FINISH = true;',1)
 w({'s':'readOnlyJniFinishWitness','enabled':True})
if os.environ.get('WZM_JNI_ALL_VOID') == '1':
 assert 'const OBSERVE_JNI_ALL_VOID = false;' in source
 source=source.replace('const OBSERVE_JNI_ALL_VOID = false;', 'const OBSERVE_JNI_ALL_VOID = true;',1)
 w({'s':'readOnlyJniAllVoidWitness','enabled':True})
if os.environ.get('WZM_GAME_LOG') == '1':
 assert 'const OBSERVE_GAME_LOG = false;' in source
 source=source.replace('const OBSERVE_GAME_LOG = false;', 'const OBSERVE_GAME_LOG = true;',1)
 w({'s':'readOnlyGameLogWitness','enabled':True})
if os.environ.get('WZM_BINDER') == '1':
 assert 'const OBSERVE_BINDER = false;' in source
 source=source.replace('const OBSERVE_BINDER = false;', 'const OBSERVE_BINDER = true;',1)
 w({'s':'readOnlyBinderWitness','enabled':True})
if os.environ.get('WZM_BLOCK_KILL') == '1':
 assert 'const BLOCK_KILL_SWITCH = false;' in source
 assert "const OBSERVE_BINDER = true;" in source or os.environ.get('WZM_BINDER') == '1'
 source=source.replace('const BLOCK_KILL_SWITCH = false;', 'const BLOCK_KILL_SWITCH = true;',1)
 if 'const OBSERVE_BINDER = true;' not in source:
  source=source.replace('const OBSERVE_BINDER = false;', 'const OBSERVE_BINDER = true;',1)
 w({'s':'killSwitch','enabled':True,'memoryOnly':True})
if os.environ.get('WZM_FORCE_LOOPBACK') == '1':
 assert 'const FORCE_LOOPBACK_CHAN = false;' in source
 source=source.replace('const FORCE_LOOPBACK_CHAN = false;', 'const FORCE_LOOPBACK_CHAN = true;',1)
 w({'s':'loopbackForce','enabled':True,'memoryOnly':True})
if os.environ.get('WZM_CL_RESEND') == '1':
 assert 'const OBSERVE_CL_RESEND = false;' in source
 source=source.replace('const OBSERVE_CL_RESEND = false;', 'const OBSERVE_CL_RESEND = true;',1)
 w({'s':'clResendObserver','enabled':True,'readOnly':True})
if os.environ.get('WZM_NULL_ENTITY_GUARD') == '1':
 assert 'const NULL_ENTITY_GUARD = false;' in source
 source=source.replace('const NULL_ENTITY_GUARD = false;', 'const NULL_ENTITY_GUARD = true;',1)
 w({'s':'nullEntityGuard','enabled':True,'memoryOnly':True,'pcRedirect':True})
if os.environ.get('WZM_SEND_GAMESTATE') == '1':
 assert 'const SEND_GAMESTATE = false;' in source
 source=source.replace('const SEND_GAMESTATE = false;', 'const SEND_GAMESTATE = true;',1)
if os.environ.get('WZM_PACK_INSTALLED'):
 # mark an optional content pack (e.g. Verdansk) installed in the game's file registry
 _d=os.path.dirname(os.path.abspath(__file__))
 _names=json.load(open(os.path.join(_d,os.environ['WZM_PACK_INSTALLED'])))
 source += '\n' + 'globalThis.WZM_PACK_FILES=' + json.dumps(_names) + ';\n' + open(os.path.join(_d,'pack_installed.js')).read()
if os.environ.get('WZM_SKIP_ENTCHK') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'skip_entchk.js')).read()
if os.environ.get('WZM_ZONE_INJECT'):
 # serve a custom fastfile in place of an existing zone (zone_inject_prep.py writes the config)
 _d=os.path.dirname(os.path.abspath(__file__))
 source += '\n' + 'globalThis.WZM_ZONE_INJECT=' + open(os.path.join(_d,os.environ['WZM_ZONE_INJECT'])).read() + ';\n' + open(os.path.join(_d,'zone_inject.js')).read()
if os.environ.get('WZM_GFX') == '1':
 if os.environ.get('WZM_GFX_TEX') == '0':
  # game's own texture settings (e.g. to test streaming limits on big maps)
  source += '\n' + 'globalThis.WZM_GFX_ENV=Object.assign({},globalThis.WZM_GFX_ENV||{}, {tex:false});'
 if os.environ.get('WZM_GFX_FIXED640') == '1':
  # Opt-out with WZM_GFX_FIXED640=0; Android display/HUD unchanged.
  source += '\n' + 'globalThis.WZM_GFX_ENV=Object.assign({},globalThis.WZM_GFX_ENV||{}, {pct:75});'
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gfx_apply.js')).read()
 if os.environ.get('WZM_GFX_FIXED640') == '1':
  source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gfx_fixed_640_native.js')).read()
if os.environ.get('WZM_AIM_SWITCHES') == '1':
 # opt-in (untested 8 Nov): aim-assist profile switches on, re-applied because the fake profile resets each boot
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'aim_switches.js')).read()
 w({'s':'aimSwitchesIncluded'})
if os.environ.get('WZM_AIM_WEAPONS') in ('probe','boost'):
 # opt-in (untested 8 Nov): per-weapon aim-assist numbers. probe = read-only report, boost = multiply (WZM_AIM_ENV json overrides factors)
 source += '\n' + 'globalThis.WZM_AIM_MODE=' + json.dumps(os.environ['WZM_AIM_WEAPONS']) + ';globalThis.WZM_AIM_ENV=' + (os.environ.get('WZM_AIM_ENV') or '{}') + ';\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'aim_weapons.js')).read()
 w({'s':'aimWeaponsIncluded','mode':os.environ['WZM_AIM_WEAPONS']})
if os.environ.get('WZM_FILE_TRACE') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'file_trace.js')).read()
 w({'s':'fileTraceIncluded'})
if os.environ.get('WZM_EXIT_BLOCK') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exit_block.js')).read()
 w({'s':'exitBlockIncluded'})
if os.environ.get('WZM_BLUR') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blur_enable.js')).read()
 w({'s':'blurEnableIncluded'})
if os.environ.get('WZM_GFX_MIN') == '1':
 source += '\n' + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gfx_min.js')).read()
 w({'s':'gfxMinProfile','enabled':True})
if os.environ.get('WZM_BOTS') == '1':
 assert 'const BOTS = false;' in source
 source=source.replace('const BOTS = false;', 'const BOTS = true;',1)
if os.environ.get('WZM_JOIN_ALLIES') == '1':
 assert 'const JOIN_ALLIES = false;' in source
 source=source.replace('const JOIN_ALLIES = false;', 'const JOIN_ALLIES = true;',1)
_enemy_ai=os.environ.get('WZM_ENEMY_AI','')
if _enemy_ai:
 assert _enemy_ai.isdigit(), 'WZM_ENEMY_AI must be a non-negative integer'
 assert 'const ENEMY_AI = -1;' in source
 source=source.replace('const ENEMY_AI = -1;', 'const ENEMY_AI = '+_enemy_ai+';',1)
if os.environ.get('WZM_MATCH_PROBE') == '1':
 assert 'const MATCH_PROBE = false;' in source
 source=source.replace('const MATCH_PROBE = false;', 'const MATCH_PROBE = true;',1)
if os.environ.get('WZM_MATCH_LUA'):
 import json as _j
 assert 'const MATCH_PROBE = true;' in source, 'WZM_MATCH_LUA needs WZM_MATCH_PROBE=1'
 source=source.replace('const MATCH_LUA_OVERRIDE = null;','const MATCH_LUA_OVERRIDE = '+_j.dumps(open(os.environ['WZM_MATCH_LUA']).read())+';',1)
if os.environ.get('WZM_MATCH_LUA_STEPS'):
 import json as _j
 assert 'const MATCH_PROBE = true;' in source, 'WZM_MATCH_LUA_STEPS needs WZM_MATCH_PROBE=1'
 _st=[]
 for _part in os.environ['WZM_MATCH_LUA_STEPS'].split(','):
  _d,_f=_part.split(':',1); _st.append([int(_d),open(_f).read()])
 source=source.replace('const MATCH_LUA_STEPS = null;','const MATCH_LUA_STEPS = '+_j.dumps(_st)+';',1)
if os.environ.get('WZM_MATCH_LUA_DELAY'):
 source=source.replace('const MATCH_LUA_DELAY = 10000;','const MATCH_LUA_DELAY = '+str(int(os.environ['WZM_MATCH_LUA_DELAY']))+';',1)
if os.environ.get('WZM_NATURAL_UI_RESTART') == '1':
 assert 'const NATURAL_UI_RESTART = false;' in source
 source=source.replace('const NATURAL_UI_RESTART = false;', 'const NATURAL_UI_RESTART = true;',1)
if os.environ.get('WZM_LOAD_CLIENT_ZONES') == '1':
 assert 'const LOAD_CLIENT_ZONES = false;' in source
 source=source.replace('const LOAD_CLIENT_ZONES = false;', 'const LOAD_CLIENT_ZONES = true;',1)
if os.environ.get('WZM_UI_MISSING_NIL') == '1':
 assert 'const UI_MISSING_NIL = false;' in source
 source=source.replace('const UI_MISSING_NIL = false;', 'const UI_MISSING_NIL = true;',1)
for flag in ('QUIT_TRACE','QUIT_BLOCK'):
 if os.environ.get('WZM_'+flag) == '1':
  source=source.replace(flag+' = false',flag+' = true',1)
for flag in ('MODE_WATCH','MODE_LOCK'):
 if os.environ.get('WZM_'+flag) == '1':
  assert 'const MODE_WATCH = false, MODE_LOCK = false;' in source or flag+' = true' in source
  source=source.replace(flag+' = false',flag+' = true',1)
if os.environ.get('WZM_QUIET') == '1':
 assert 'const QUIET = false;' in source
 source=source.replace('const QUIET = false;', 'const QUIET = true;',1)
if os.environ.get('WZM_LOW_OVERHEAD') == '1':
 assert 'const LOW_OVERHEAD = false;' in source
 source=source.replace('const LOW_OVERHEAD = false;', 'const LOW_OVERHEAD = true;',1)
 w({'s':'lowOverheadMode','enabled':True})
if os.environ.get('WZM_OMNVAR_ADD'):
 assert 'const OMNVAR_ADD = [];' in source
 source=source.replace('const OMNVAR_ADD = [];', 'const OMNVAR_ADD = '+json.dumps(os.environ['WZM_OMNVAR_ADD'].split(','))+';',1)
if os.environ.get('WZM_OMNVAR_GAMETYPE'):
 assert "const OMNVAR_GAMETYPE = '';" in source
 source=source.replace("const OMNVAR_GAMETYPE = '';", "const OMNVAR_GAMETYPE = '"+os.environ['WZM_OMNVAR_GAMETYPE']+"';",1)
if os.environ.get('WZM_LUA_CHUNK_DUMP'):
 assert 'const LUA_CHUNK_DUMP = [];' in source
 source=source.replace('const LUA_CHUNK_DUMP = [];', 'const LUA_CHUNK_DUMP = '+json.dumps(os.environ['WZM_LUA_CHUNK_DUMP'].split(','))+';',1)
if os.environ.get('WZM_UI_LOOKUP_TRACE') == '1':
 assert 'const UI_LOOKUP_TRACE = false;' in source
 source=source.replace('const UI_LOOKUP_TRACE = false;', 'const UI_LOOKUP_TRACE = true;',1)
if os.environ.get('WZM_LUA_ASSET_CACHE') == '1':
 assert 'const LUA_ASSET_CACHE = false;' in source
 source=source.replace('const LUA_ASSET_CACHE = false;', 'const LUA_ASSET_CACHE = true;',1)
if os.environ.get('WZM_UI_WAIT_ASSET') == '1':
 assert 'const UI_WAIT_ASSET = false;' in source
 source=source.replace('const UI_WAIT_ASSET = false;', 'const UI_WAIT_ASSET = true;',1)
if os.environ.get('WZM_UI_RETRY') == '1':
 assert 'const UI_RETRY = false;' in source
 source=source.replace('const UI_RETRY = false;', 'const UI_RETRY = true;',1)
if os.environ.get('WZM_FAKE_PLAYER_DATA') == '1':
 assert 'const HOST_START_PROPAGATE = false;' in source
 source=source.replace('const HOST_START_PROPAGATE = false;', 'const HOST_START_PROPAGATE = true;',1)
if os.environ.get('WZM_MP_MODE'):
 v=os.environ['WZM_MP_MODE']
 assert 'const MP_MODE = -1;' in source
 source=source.replace('const MP_MODE = -1;', 'const MP_MODE = %d;' % (-2 if v == 'list' else int(v)),1)
if os.environ.get('WZM_FORCE_OOB_CMD') == '1':
 assert 'const FORCE_OOB_CMD = false;' in source
 source=source.replace('const FORCE_OOB_CMD = false;', 'const FORCE_OOB_CMD = true;',1)
 w({'s':'oobCmdForce','enabled':True,'memoryOnly':True,'registerOnly':True})
if os.environ.get('WZM_OBSERVE_CONNECT_ID') == '1':
 assert 'const OBSERVE_CONNECT_ID = false;' in source
 source=source.replace('const OBSERVE_CONNECT_ID = false;', 'const OBSERVE_CONNECT_ID = true;',1)
 w({'s':'connectIdObserver','enabled':True,'readOnly':True})
if os.environ.get('WZM_VM53_CURSOR') == '1':
 assert 'const OBSERVE_VM53_CURSOR = false;' in source
 source=source.replace('const OBSERVE_VM53_CURSOR = false;', 'const OBSERVE_VM53_CURSOR = true;',1)
 if 'const OBSERVE_PROTECTED_WRAPPERS = true;' not in source:
  source=source.replace('const OBSERVE_PROTECTED_WRAPPERS = false;', 'const OBSERVE_PROTECTED_WRAPPERS = true;',1)
 w({'s':'readOnlyVm53CursorTrace','enabled':True,'wrapperObserver':True})
if os.environ.get('WZM_VM53_STEER') == '1':
 assert 'const STEER_VM53_ZERO_PRED = false;' in source
 source=source.replace('const STEER_VM53_ZERO_PRED = false;', 'const STEER_VM53_ZERO_PRED = true;',1)
 if 'const OBSERVE_VM53_CURSOR = true;' not in source:
  source=source.replace('const OBSERVE_VM53_CURSOR = false;', 'const OBSERVE_VM53_CURSOR = true;',1)
 if 'const OBSERVE_PROTECTED_WRAPPERS = true;' not in source:
  source=source.replace('const OBSERVE_PROTECTED_WRAPPERS = false;', 'const OBSERVE_PROTECTED_WRAPPERS = true;',1)
 w({'s':'vm53SteerZeroPred','enabled':True,'memoryOnly':True,'singleWrite':True})
if os.environ.get('WZM_VM53_STEER_PIN') == '1':
 assert 'const STEER_VM53_PIN_PRED = false;' in source
 source=source.replace('const STEER_VM53_PIN_PRED = false;', 'const STEER_VM53_PIN_PRED = true;',1)
 if 'const OBSERVE_VM53_CURSOR = true;' not in source:
  source=source.replace('const OBSERVE_VM53_CURSOR = false;', 'const OBSERVE_VM53_CURSOR = true;',1)
 if 'const OBSERVE_PROTECTED_WRAPPERS = true;' not in source:
  source=source.replace('const OBSERVE_PROTECTED_WRAPPERS = false;', 'const OBSERVE_PROTECTED_WRAPPERS = true;',1)
 w({'s':'vm53SteerPinPred','enabled':True,'memoryOnly':True})
if os.environ.get('WZM_THREAD_NAMES') == '1':
 def poll_thread_names():
  for _ in range(int(secs*2)):
   time.sleep(.5)
   try:
    out=subprocess.check_output(['adb','-s','PHONE_IP:5555','shell',"su -c 'for t in /proc/"+str(pid)+"/task/*; do read n < $t/comm; echo ${t##*/}:$n; done'"],text=True,timeout=8)
    w({'s':'threadNames','names':dict(l.split(':',1) for l in out.splitlines() if ':' in l)})
   except Exception as e:
    w({'s':'threadNamesFailed','e':str(e)[:80]})
 threading.Thread(target=poll_thread_names,daemon=True).start()
 w({'s':'threadNamePollerArmed','intervalSeconds':0.5})
if deferred_lifecycle:
   assert os.environ.get('WZM_VM_WRAPPER_OBSERVE') == '1', 'Deferred lifecycle needs VM53 wrapper observation enabled'
   assert os.environ.get('WZM_LIFECYCLE_TRACE') != '1', 'Use either upfront or deferred lifecycle trace, not both'
   w({'s':'deferredLifecycleArmed','trigger':'original VM53 wrapper entry','readOnly':True})
sc=s.create_script(source)
sc.on('message',lambda x,_:w(x.get('payload',x)));sc.load()
# WZM_MENU_ONLY=1: arm every offline hook but stay at the main menu (no match request).
MENU_ONLY=os.environ.get('WZM_MENU_ONLY')=='1'
GO_FILE=sys.argv[4]+'.go'  # menu-only: the launcher writes {"map","gametype","enemies"} here to start a match
if MENU_ONLY: w({'s':'menuOnlyArmed','goFile':GO_FILE})
else: sc.exports_sync.go(m,g)
last=None
for i in range(int(secs*2)):
 time.sleep(.5)
 if MENU_ONLY and os.path.exists(GO_FILE):
  try:
   req=json.load(open(GO_FILE));os.remove(GO_FILE)
   sc.exports_sync.go(req['map'],req['gametype'],req.get('enemies'))
   w({'s':'menuMatchStarted',**req})
  except Exception as e: w({'s':'menuMatchFailed','e':str(e)[:120]})
 try:r=sc.exports_sync.snap()
 except Exception as e:w({'s':'snapFailed','e':str(e)[:80]});break
 if r!=last:w({'s':'state','t':i/2,**r});last=r
 if i in(4,10):
  o=subprocess.run(['adb','-s','PHONE_IP:5555','shell',"su -c 'sh /data/local/tmp/th.sh'"],capture_output=True,text=True).stdout
  print(o[:1500],flush=True);open(sys.argv[4]+'.perf','a').write(o)
os._exit(0)
