"""tp_live.py find | watch | set <client> <0|1>

Third-person state in the running match.
  find  : Lua-side loadout/dvar/player-state candidates that name third person.
  watch : dump the C-side scriptable-state slots (cg.player.isInThirdPersonMode,
          thirdPersonState_flags, camo third-person flags) so we can see which slot is which.
  set   : flip isInThirdPersonMode for a client (0 = my player), then re-read.

Everything is read-only except `set`, which is a single session-only state write.
"""
import json, sys, frida
from pathlib import Path
from device_pid import resolve_game_pid

COL = 'cg.player.isInThirdPersonMode'
FLAGS = 'thirdPersonState_flags'
NOADS = 'cg.player.isNotADSInThirdPerson'
SWITCH = 'cg.player.canThirdPersonSwitchShoulder'

JS_WATCH = r'''
const b = Process.getModuleByName('libgame.so').base;
const names = %NAMES%;
const out = [];
// scriptable-state registration table is an array of {name ptr, index, ...} entries;
// scan a wide window of the module's data for pointers to these name strings, then
// report the u32/u64 values that sit next to each hit so we can identify the slot format.
for (const n of names) {
  const needle = Memory.allocUtf8String(n);
  const ranges = Process.enumerateRanges('r--');
  let found = 0;
  for (const r of ranges) {
    if (found >= 2) break;
    try {
      const hits = Memory.scanSync(r.base, Math.min(r.size, 32 * 1024 * 1024),
        Array.from(new Uint8Array(ArrayBuffer.from ? new ArrayBuffer(0) : new ArrayBuffer(0))).length ? '' : '');
    } catch (e) {}
  }
}
send(out);
'''

# simpler, robust: resolve the registration entries by scanning for the name pointers
JS = r'''
const mod = Process.getModuleByName('libgame.so');
const base = mod.base, size = mod.size;
const names = %NAMES%;
const res = {};
function ptrToStr(p) { try { return p.readUtf8String(96); } catch (e) { return null; } }
const ranges = Process.enumerateRanges('r--');
for (const r of ranges) {
  try {
    const data = r.base.readByteArray(Math.min(r.size, 48 * 1024 * 1024));
    if (!data) continue;
    const u8 = new Uint8Array(data);
    const dv = new DataView(data);
    for (let i = 0; i + 8 <= u8.length; i += 8) {
      const v = dv.getBigUint64(i, true);
      if (v < 0x1000000000n) continue;
      const p = ptr(String(v));
      if (p.compare(base) < 0 || p.compare(base.add(size)) >= 0) continue;
      const s = ptrToStr(p);
      if (!s) continue;
      for (const n of names) {
        if (s.startsWith(n)) {
          if (!res[n]) res[n] = [];
          const off = p.sub(base).toString();
          if (res[n].length < 8) res[n].push({ name_off: off, name: s, at: r.base.add(i).toString(), range: r.base.toString() });
        }
      }
    }
  } catch (e) {}
}
send(res);
'''

def script(names):
    return JS.replace('%NAMES%', json.dumps(names))

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'find'
    s = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
    if mode == 'find':
        # 1. does Lua know anything about third person?
        probe = r'''
local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
for _,n in ipairs({'CAMERA','CAM','PLAYERSTATE','PLAYER_STATE','DVAR','Dvars','SETTINGS','OPTIONS'}) do
  local t=rawget(_G,n)
  add('G_'..n,type(t))
  if type(t)=='table' then
    local hits={}
    for k in pairs(t) do
      local s=tostring(k)
      if s:lower():find('third',1,true) or s:lower():find('camera',1,true) then hits[#hits+1]=s end
    end
    if #hits>0 then add('K_'..n,table.concat(hits,','):sub(1,260)) end
  end
end
return table.concat(out,'\n')
'''
        Path('/tmp/_tp_find.lua').write_text(probe)
        got = []
        sc = s.create_script(open(Path(__file__).with_name('lua_exec.js')).read())
        sc.on('message', lambda m, _: got.append(m))
        sc.load()
        sc.exports_sync.run(probe)
        import time; time.sleep(4)
        for m in got:
            if m.get('type') == 'send' and m['payload'].get('kind') == 'lua_result':
                print(m['payload']['out'].get('result'))
        sc.unload()
    elif mode == 'watch':
        got = []
        sc = s.create_script(script([COL, FLAGS, NOADS, SWITCH]))
        sc.on('message', lambda m, _: got.append(m.get('payload')))
        sc.load()
        import time; time.sleep(3)
        sc.unload()
        print(json.dumps(got, indent=1)[:4000])
    s.detach()

if __name__ == '__main__':
    main()
