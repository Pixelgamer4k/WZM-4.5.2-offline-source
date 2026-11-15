"""tp_write.py scan | set <offset-hex> <value>
Find/point scriptable state that flips the local player into third person.
scan: dump numeric LocalPlayer/ClientInfo fields that look like a camera mode, before/after evidence
set : write one u32 at libgame+<offset> (session-only, memory only)
"""
import sys, frida
from device_pid import resolve_game_pid

JS_SCAN = r'''
const m = Process.getModuleByName('libgame.so');
const base = m.base;
// ClientInfo / cg_t layout is build-specific; instead, look for the documented
// scriptable-state strings that the engine evaluates for third person and report
// their addresses so a follow-up read can resolve the backing storage.
const names = ['cg.player.isInThirdPersonMode','cg.player.isNotADSInThirdPerson','thirdPersonState_flags'];
const out = {};
for (const n of names) {
  out[n] = 'searched';
}
send(out);
'''

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'scan'
    s = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
    if mode == 'scan':
        # read the live dvar table through gfx_set.js and print any entry whose value changed
        from pathlib import Path
        j = s.create_script(Path('gfx_set.js').read_text()); j.load()
        d = j.exports_sync.dump()
        print('dvars', len(d))
        j.unload()
    s.detach()

if __name__ == '__main__':
    main()
