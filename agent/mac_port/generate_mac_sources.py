#!/usr/bin/env python3
"""Generate mac_sources.js: the EXACT Frida sources the working Mac/root pipeline loads.

The host source is produced by running the real host_spawn.py with the same
environment play_mp.sh -> play_with_bots.sh -> play_offline.sh exports, against a
mock `frida` module that captures the string passed to create_script().  That way
every flag substitution and appended file matches the proven Mac launch byte for
byte; nothing is re-derived by hand.
"""
import json
import os
import re
import runpy
import sys
import tempfile
import threading
import types
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRIDGE = Path(__file__).resolve().parents[2] / 'bridge'
OUT = HERE / 'mac_sources.js'

# play_offline.sh / play_with_bots.sh / play_mp.sh, Nuketown/Crash TDM defaults.
BASE_ENV = {
    'WZM_FAKE_PLAYER_DATA': '1', 'WZM_VM53_STEER_PIN': '1', 'WZM_FORCE_LOOPBACK': '1',
    'WZM_NULL_ENTITY_GUARD': '1', 'WZM_ROUTE_LOCAL_HOST_PACKET': '1', 'WZM_FORCE_OOB_CMD': '1',
    'WZM_SEND_GAMESTATE': '1', 'WZM_GFX': '1', 'WZM_GFX_FIXED640': '1', 'WZM_QUIET': '1',
    'WZM_MP_MODE': '211', 'WZM_UI_RETRY': '1', 'WZM_LUA_ASSET_CACHE': '1', 'WZM_UI_MISSING_NIL': '1',
    'WZM_OMNVAR_ADD': '0x750bd5872bb1d322', 'WZM_JOIN_ALLIES': '1', 'WZM_MATCH_PROBE': '1',
    'WZM_LUI_SEND': 'class_select:0@22000',
    'WZM_MATCH_LUA_STEPS': '17000:hitmarker_scale_state.lua,18000:hitmarker_scale_bind.lua,'
                           '19000:aa_state.lua,25000:hitmarker_bind_state.lua,30000:hitmarker_bind_state.lua,'
                           '45000:hitmarker_bind_state.lua,75000:hitmarker_bind_state.lua,120000:hitmarker_bind_state.lua',
    'WZM_BOTS': '1', 'WZM_GAMESTATE_RETRY': '0', 'WZM_NATIVE_BOT_ONCE': '0', 'WZM_NATIVE_BOT_CONNECT': '0',
    'WZM_LOW_OVERHEAD': '1',
}
# menu.sh: WZM_MENU_ONLY=1 WZM_MENU_RETURN=0 WZM_BOTS=1 WZM_ENEMY_AI=4 WZM_PACK_INSTALLED=...
# WZM_CLASS=pick (no WZM_LUI_SEND), through play_offline.sh (no WZM_LOW_OVERHEAD).
# WZM_ZONE_INJECT/WZM_SKIP_ENTCHK are Broadcast-only and need extra device files; left out.
# play_mp.sh cold path (the one with working spawns and bots). Class preset is
# substituted at Play time: WZM_CLASS=N -> class_select:(N-1)@22000.
VARIANTS = {
    'play': {'WZM_LUI_SEND': 'class_select:__WZM_CLASS_INDEX__@22000'},
    'verdansk': {'WZM_LUI_SEND': 'class_select:__WZM_CLASS_INDEX__@22000',
                 'WZM_PACK_INSTALLED': 'verdansk_pack_files.json', 'WZM_GFX_TEX': '0'},
}
DROP_FOR_MENU = ()


class Captured(Exception):
    pass


# lui_send.js fires each item once per process. For back-to-back matches from the
# menu (never done on the Mac) expose a per-match reset that also sets the class.
LUI_ANCHOR = ' globalThis.luiSendPage=page;'
LUI_RESET = (' globalThis.luiSendPage=page;\n'
             ' globalThis.luiSendReset=(cls)=>{readyAt=0;for(const i of spec){i.done=false;'
             'if(i.name===\'class_select\'&&Number.isInteger(cls))i.value=cls;}'
             'send({s:\'luiSendReset\',items:spec.map(i=>i.name+\':\'+i.value+\'@\'+i.at)});};')


# Graphics tab: user settings (stage global WZM_GFX_ENV) must win over the launcher
# default {pct:75}; options the files hard-code become settable; a master switch.
def gfx_configurable(src):
    a = read('gfx_apply.js')
    f = read('gfx_fixed_640_native.js')
    assert src.count(a) == 1 and src.count(f) == 1, 'gfx files not found verbatim in host'
    a2 = a.replace("'d2a2a59552643885':1,", "'d2a2a59552643885':E.aa===undefined?1:E.aa,")
    assert a2 != a
    f2 = f.replace("const pct=Math.max(40,Math.min(100,Math.round(137600/w)));",
                   "const GE=globalThis.WZM_GFX_ENV||{};"
                   "const pct=GE.sceneH==='native'?100:Math.max(40,Math.min(100,Math.round("
                   "(GE.sceneH?Math.round(GE.sceneH*1376/640):1376)*100/w)));")
    f2 = f2.replace("if(dynamic && w>=1200", "if(!(globalThis.WZM_GFX_ENV||{}).dynamic && dynamic && w>=1200")
    assert f2.count('GE.sceneH') == 3 and '.dynamic && dynamic' in f2
    guard = "if(!((globalThis.WZM_GFX_ENV||{}).off))"
    src = src.replace(a, guard + a2).replace(f, guard + f2)
    old = "globalThis.WZM_GFX_ENV=Object.assign({},globalThis.WZM_GFX_ENV||{}, {pct:75});"
    assert src.count(old) == 1
    return src.replace(old, "globalThis.WZM_GFX_ENV=Object.assign({}, {pct:75}, globalThis.WZM_GFX_ENV||{});")


# Some devices (Redmi, Android 13) have no free memory near libgame for Frida's
# short jump, so hooks on tiny functions fail. Same effect, hooked at a safe spot.
HOOK_FALLBACKS = [
    ("Interceptor.attach(at(0x375afcc),{onLeave(r){if(flowOverride)r.replace(ptr(1));}});",
     # 0x375afcc: stp; mov; bl 0x1b28bf8; cmp w0,#2; cset w0,eq; ... -> force w0=2 before the cmp
     "try{Interceptor.attach(at(0x375afcc),{onLeave(r){if(flowOverride)r.replace(ptr(1));}});}"
     "catch(e){Interceptor.attach(at(0x375afd8),{onEnter(){if(flowOverride)this.context.x0=ptr(2);}});"
     "send({s:'hookFallback',site:'0x375afcc->0x375afd8'});}"),
]


def capture_host(extra):
    captured = {}

    class Script:
        def __init__(self, source):
            captured['source'] = source
            raise Captured()

    class Session:
        def create_script(self, source):
            return Script(source)

    frida = types.ModuleType('frida')
    frida.get_device_manager = lambda: types.SimpleNamespace(
        add_remote_device=lambda _addr: types.SimpleNamespace(attach=lambda _pid: Session()))
    device_pid = types.ModuleType('device_pid')
    device_pid.resolve_game_pid = lambda *a, **k: 4242

    saved_env = dict(os.environ)
    saved_argv = list(sys.argv)
    saved_timer = threading.Timer
    saved_cwd = os.getcwd()
    with tempfile.TemporaryDirectory() as tmp:
        try:
            for key in list(os.environ):
                if key.startswith('WZM_'):
                    del os.environ[key]
            os.environ.update(BASE_ENV)
            for key in DROP_FOR_MENU:
                os.environ.pop(key, None)
            os.environ.update(extra)
            sys.modules['frida'] = frida
            sys.modules['device_pid'] = device_pid
            threading.Timer = lambda *a, **k: types.SimpleNamespace(start=lambda: None, cancel=lambda: None)
            os.chdir(BRIDGE)  # WZM_MATCH_LUA_STEPS opens lua files relative to the cwd
            sys.argv = ['host_spawn.py', '3600', 'mp_mgl_nuketown', '0x3f9bd6e4038d651d', tmp + '/log.jsonl']
            try:
                runpy.run_path(str(BRIDGE / 'host_spawn.py'), run_name='__main__')
            except Captured:
                pass
        finally:
            os.chdir(saved_cwd)
            threading.Timer = saved_timer
            sys.argv = saved_argv
            os.environ.clear()
            os.environ.update(saved_env)
            sys.modules.pop('frida', None)
            sys.modules.pop('device_pid', None)
    if 'source' not in captured:
        raise SystemExit('host_spawn.py did not reach create_script')
    src = captured['source']
    src = gfx_configurable(src)
    for old, new in HOOK_FALLBACKS:
        assert src.count(old) == 1, old
        src = src.replace(old, new)
    if 'WZM_LUI_SEND' in extra:
        assert src.count(LUI_ANCHOR) == 1, 'lui_send.js layout changed'
        src = src.replace(LUI_ANCHOR, LUI_RESET)
    return src


def fake_player_js():
    text = (BRIDGE / 'fake_player_data.py').read_text()
    match = re.search(r'JS=r"""(.*?)"""', text, re.S)
    if not match:
        raise SystemExit('fake_player_data.py JS block not found')
    return match.group(1)


def read(name):
    return (BRIDGE / name).read_text()


# lua_exec.js saves L->top (LuaJIT GC64 lua_State+0x28) as a raw pointer and writes
# it back. If the chunk grows the Lua stack, L->stack (+0x38) is reallocated and the
# saved pointer dangles -> later VM crash. Restore it relative to the stack base.
LUA_TOP_SAVE = 'const top=L.add(0x28).readPointer();'
LUA_TOP_RESTORE = 'L.add(0x28).writePointer(top);'
SAFE_SAVE = ('const top=L.add(0x28).readPointer(),stk0=L.add(0x38).readPointer(),'
             'topOff=(top.compare(stk0)>=0&&top.compare(L.add(0x30).readPointer())<=0)?top.sub(stk0):null;')
SAFE_RESTORE = 'L.add(0x28).writePointer(topOff===null?top:L.add(0x38).readPointer().add(topOff));'


def safe_lua_exec(js):
    assert js.count(LUA_TOP_SAVE) == 1 and js.count(LUA_TOP_RESTORE) == 1, 'lua_exec.js layout changed'
    return js.replace(LUA_TOP_SAVE, SAFE_SAVE).replace(LUA_TOP_RESTORE, SAFE_RESTORE)


def catalog_js():
    text = read('frontend_weapon_catalog.py')
    match = re.search(r"js=r\'\'\'(.*?)\'\'\'", text, re.S)
    if not match:
        raise SystemExit('frontend_weapon_catalog.py js block not found')
    return match.group(1).replace('APPLY', 'true')


def hub_js():
    # Same transformation restore_hub_binary.py applies to lua_exec.js.
    blob = (BRIDGE.parents[1] / 'frontend_offline_static_20261104/module_11d1836.ljbc').read_bytes()
    js = safe_lua_exec(read('lua_exec.js'))
    start = js.index('  const buf=Memory.allocUtf8String(src);')
    end = js.index('  const s=tostr', start)
    return js[:start] + '''  const bytes=BYTES;
  const buf=Memory.alloc(bytes.length);buf.writeByteArray(bytes);
  out.load=load(L,buf,bytes.length,name,ptr(0));
  if(out.load===0){
    const arg="for k,v in pairs(MobileMainMenuButtons) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then return v.menuName end end error('missing gear key')";
    const ab=Memory.allocUtf8String(arg);
    out.argLoad=load(L,ab,arg.length,name,ptr(0));
    if(out.argLoad===0)out.argCall=pcall(L,0,1,0);
    if(out.argCall===0)out.pcall=pcall(L,1,1,0);
  }
'''.replace('BYTES', json.dumps(list(blob))) + js[end:]


def main():
    hosts = {name: capture_host(env) for name, env in VARIANTS.items()}
    for name, source in hosts.items():
        assert 'const STEER_VM53_PIN_PRED = true;' in source, name
        assert 'const HOST_START_PROPAGATE = true;' in source, name
        assert 'const BOTS = true;' in source, name
        assert 'const ENEMY_AI = -1;' in source, name  # roster passed at go(m,g,enemies)
        assert source.count('__WZM_CLASS_INDEX__') >= 1, name
        assert 'const LOW_OVERHEAD = true;' in source, name
    assert 'WZM_PACK_FILES' in hosts['verdansk'] and 'WZM_PACK_FILES' not in hosts['play']
    assert 'tex:false' in hosts['verdansk']
    sources = {
        'HOST_PLAY': hosts['play'],
        'HOST_VERDANSK': hosts['verdansk'],
        'LUA_EXEC': safe_lua_exec(read('lua_exec.js')),
        'FAKE_PLAYER_JS': fake_player_js(),
        'FAKE_PLAYER_LUA': read('fake_player_data.lua'),
        'PARTY_INJECT': read('party_bot_inject.js'),
        'BOTH_SIDES_AI': read('native_ai_both_sides.js'),
        'VETERAN_GUARD': read('native_ai_veteran_guard.js'),
        # unlock_all_menu.sh / prepare_loadout_frontend.sh / menu_keeper.sh
        'PREVIEW_GUARD': read('frontend_preview_guard.js'),
        'WEAPON_CATALOG': catalog_js(),
        'HUB_RESTORE': hub_js(),
        'LUA_OFFLINE_UNLOCKS': read('offline_unlocks.lua'),
        'LUA_CLIENT_FENCE': read('offline_client_fence.lua'),
        'LUA_SEED_LOADOUTS': read('seed_all_loadouts.lua'),
        'LUA_UNLOCKS_EXT': read('offline_unlocks_ext.lua'),
        'LUA_UNLOCKS_LEVEL': read('offline_unlocks_level.lua'),
        'LUA_OPEN_GEAR_UP': read('open_gear_up.lua'),
        'LUA_CHECK_UNLOCK': read('check_unlock_state.lua'),
        'LUA_SKIP_ONLINE_FENCES': read('skip_online_fences.lua'),
        'LUA_DUMP_LOADOUTS': read('dump_loadouts.lua'),
        # menu_return_watch.py: watch.js + skip_online_fences.lua after the match ends
        'WATCH_JS': read('watch.js'),
    }
    sites = set()
    for key in ('HOST_PLAY', 'PARTY_INJECT', 'BOTH_SIDES_AI', 'VETERAN_GUARD', 'LUA_EXEC', 'FAKE_PLAYER_JS',
                'WEAPON_CATALOG', 'PREVIEW_GUARD', 'WATCH_JS'):
        for m in re.finditer(r'Interceptor\.(?:attach|replace|replaceFast)\(at\((0x[0-9a-f]+)\)', sources[key]):
            sites.add(int(m.group(1), 16))
    sources['PROBE_SITES'] = sorted(sites)
    lines = ['// GENERATED by generate_mac_sources.py from the working Mac lua_bridge. Do not edit.']
    for key, value in sources.items():
        lines.append(f'export const {key} = {json.dumps(value)};')
    OUT.write_text('\n'.join(lines) + '\n')
    for key, value in sources.items():
        print(f'{key}: {len(value)} chars')


if __name__ == '__main__':
    main()
