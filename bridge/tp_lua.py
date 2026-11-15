"""tp_lua.py <lua_file> : run a Lua chunk on the game thread and print the result."""
import sys, time, frida
from pathlib import Path
from device_pid import resolve_game_pid
src = Path(sys.argv[1]).read_text()
s = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
got = []
sc = s.create_script(Path(__file__).with_name('lua_exec.js').read_text())
sc.on('message', lambda m, _: got.append(m))
sc.load()
sc.exports_sync.run(src)
for _ in range(30):
    time.sleep(0.5)
    if any(m.get('payload', {}).get('kind') == 'lua_result' for m in got):
        break
for m in got:
    p = m.get('payload', {})
    if p.get('kind') == 'lua_result':
        out = p['out']
        if out.get('exception'):
            print('EXC', out['exception'])
        print(out.get('result'))
sc.unload(); s.detach()
