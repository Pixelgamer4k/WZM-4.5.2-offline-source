#!/usr/bin/env python3
"""lua_error_locate.py <script hash> <runtime line> [context]: decode bytecode behind a live Lua error.

Scripts are found by their hash stored just before each zlib stream in global.ff.
Runtime lines are the decoder's lines plus one.
"""
import bisect, json, pathlib, subprocess, sys, tempfile, zlib
here = pathlib.Path(__file__).parent
from ljbc_proto_inspect import protos

h, line = sys.argv[1], int(sys.argv[2])
ctx = int(sys.argv[3]) if len(sys.argv) > 3 else 3
ff = (here / 'reconstructed_core/zone/global.ff').read_bytes()
offs = sorted(r['offset'] for r in json.loads((here / 'runtime/ff_scripts/global_lua_index.json').read_text())['records'])
pos = ff.find(bytes.fromhex(h.zfill(16))[::-1])
assert pos != -1, 'hash not in global.ff'
off = offs[bisect.bisect_left(offs, pos)]
data = zlib.decompressobj().decompress(ff[off:off + 4_000_000])
path = pathlib.Path(tempfile.gettempdir()) / f'wzm_{off:x}.ljbc'
path.write_bytes(data)
target = line - 1
ps = [p for p in protos(data) if p['firstline'] <= target <= p['firstline'] + p['numlines'] and p['firstline'] > 0]
p = min(ps, key=lambda x: x['numlines'])
print(f"stream {off:#x} proto {p['seq']} lines {p['firstline']}-{p['firstline'] + p['numlines']}")
out = subprocess.run([sys.executable, str(here / 'menu_route_ljbc_decode.py'), str(path), '--proto', str(p['seq']), '--lo', '0', '--hi', str(p['nbc'])],
                     capture_output=True, text=True, cwd=here).stdout.splitlines()
for l in out:
    if l.startswith('PC'):
        n = int(l.split('line')[1].split()[0])
        if abs(n - target) <= ctx:
            print(l[:100])
