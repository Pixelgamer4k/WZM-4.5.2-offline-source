#!/usr/bin/env python3
"""spawn_writer.py <spec.json>: append MP spawn records to a decoded v25 zone, copying record templates
(and every string they use) from a donor zone.

spec: {"target": "work/sierra", "donor": "work/nuketown", "out": "work/sierra/decoded_bc1.bin",
       "out_prefix": "work/sierra/prefix_bc1.bin", "block_pad": {"15": 65536, ...},
       "spawns": [{"kind": "start_a"|"start_b"|"general", "x":..,"y":..,"z":..,"yaw":..}, ...]}

Format (map_ents, both zones):
  root+0x20 u32 = record count; array read (loader site 0x1723ea8) of 56-byte records:
  +0 u32 index, +4 u32 class string idx, +8 u32 str idx, +12 u32 str idx, +16 float3 origin, +28 float3 angles,
  +40 u64 kvp count, +48 u64 -1 (kvp array inline). Each record's kvps follow (site 0x176e8b4) in record order,
  16 bytes each: u64 key hash, u64 value (string idx; with tag 2<<32 for some keys).
String table: decoded+0 u64 count, table read of count*8 (entry hash/flags), then the NUL-terminated encoded
strings in entry order (entry i>0 -> string i-1). Encoded bytes are identical across zones for the same entry.
"""
import json, pickle, struct, sys

SPAWN_SITE, KVP_SITE = 0x1723ea8, 0x176e8b4
DONOR_KIND = {'start_a': (104, 252), 'start_b': (401, 252), 'general': (1252, 1178)}

class Zone:
    def __init__(s, d):
        s.dec = open(f'{d}/decoded.bin', 'rb').read(); G = pickle.load(open(f'{d}/emu.graph.pkl', 'rb'))
        s.R, s.A = G['reads'], G['assets']
        s.n = struct.unpack_from('<Q', s.dec, 0)[0]; t = s.R[1]; s.tab_off = t[0]; assert t[1] == s.n * 8
        s.ents = [struct.unpack_from('<Q', s.dec, t[0] + 8 * i)[0] for i in range(s.n)]
        lst = [r for r in s.R[:s.A[0][0]] if r[1] == len(s.A) * 16][0]
        s.str_start, s.str_end = t[0] + t[1], lst[0]
        s.strs = s.dec[s.str_start:s.str_end].split(b'\0')[:-1]  # string for entry i is strs[i-1]
        assert len(s.strs) == s.n - 1, (len(s.strs), s.n)
        me = [i for i, (r, ty) in enumerate(s.A) if ty == 40][0]; r0, r1 = s.A[me][0], s.A[me + 1][0]
        s.root = s.R[r0][0]; s.count_off = s.root + 0x20
        s.cnt = struct.unpack_from('<I', s.dec, s.count_off)[0]
        k = [k for k in range(r0, r1) if s.R[k][2] == SPAWN_SITE][0]; s.arr = (s.R[k][0], s.R[k][1]); assert s.R[k][1] == s.cnt * 56
        s.kids = [kk for kk in range(k + 1, r1) if s.R[kk][2] == KVP_SITE][:s.cnt]
        s.blocks = {s.R[1][4], s.R[k][4]} | {s.R[kk][4] for kk in s.kids}
    def rec(s, i): return s.dec[s.arr[0] + 56 * i: s.arr[0] + 56 * (i + 1)]
    def kvps(s, i): r = s.R[s.kids[i]]; return s.dec[r[0]:r[0] + r[1]]

def main():
    S = json.load(open(sys.argv[1]))
    T, D = Zone(S['target']), Zone(S['donor'])
    tidx = {v: i for i, v in enumerate(T.ents) if i}
    new_ents, new_strs, remap = [], [], {}
    def map_str(i):
        if i == 0: return 0
        if i in remap: return remap[i]
        h = D.ents[i]
        if h in tidx: remap[i] = tidx[h]
        else:
            remap[i] = T.n + len(new_ents); new_ents.append(h); new_strs.append(D.strs[i - 1])
        return remap[i]
    def map_val(v):
        hi, lo = v >> 32, v & 0xffffffff
        if hi in (0, 2) and 0 < lo < D.n: return (hi << 32) | map_str(lo)
        return v
    # donor templates per kind, cycling through real donor spawns of that kind
    pools = {k: [i for i in range(D.cnt) if struct.unpack_from('<I', D.rec(i), 4)[0] == c and struct.unpack_from('<I', D.rec(i), 12)[0] == cc]
             for k, (c, cc) in DONOR_KIND.items()}
    used = {k: 0 for k in pools}
    recs, kv = [], []
    for j, sp in enumerate(S['spawns']):
        pool = pools[sp['kind']]; di = pool[used[sp['kind']] % len(pool)]; used[sp['kind']] += 1
        r = bytearray(D.rec(di))
        struct.pack_into('<I', r, 0, T.cnt + j)
        for o in (4, 8, 12): struct.pack_into('<I', r, o, map_str(struct.unpack_from('<I', r, o)[0]))
        struct.pack_into('<3f', r, 16, sp['x'], sp['y'], sp['z'])
        struct.pack_into('<3f', r, 28, 0.0, sp.get('yaw', 0.0), 0.0)
        k = bytearray(D.kvps(di))
        for o in range(0, len(k), 16): struct.pack_into('<Q', k, o + 8, map_val(struct.unpack_from('<Q', k, o + 8)[0]))
        recs.append(bytes(r)); kv.append(bytes(k))
    # build edits (offset, insert bytes) and in-place patches
    out = bytearray(T.dec)
    struct.pack_into('<Q', out, 0, T.n + len(new_ents))
    struct.pack_into('<I', out, T.count_off, T.cnt + len(recs))
    last_kid = T.R[T.kids[-1]]
    ins = [(T.tab_off + T.n * 8, b''.join(struct.pack('<Q', h) for h in new_ents)),
           (T.str_end, b''.join(x + b'\0' for x in new_strs)),
           (T.arr[0] + T.arr[1], b''.join(recs)),
           (last_kid[0] + last_kid[1], b''.join(kv))]
    for off, b in sorted(ins, key=lambda x: -x[0]): out[off:off] = b
    open(S['out'], 'wb').write(out)
    pre = bytearray(open(f"{S['target']}/prefix.bin", 'rb').read())
    pads = S.get('block_pad') or {str(b): 65536 for b in T.blocks}
    for b, pad in pads.items():
        o = 0x40 + 8 * (int(b) + 1); struct.pack_into('<Q', pre, o, struct.unpack_from('<Q', pre, o)[0] + pad)
    open(S['out_prefix'], 'wb').write(pre)
    print(f'spawns +{len(recs)} (count {T.cnt}->{T.cnt + len(recs)}), strings +{len(new_ents)} (count {T.n}->{T.n + len(new_ents)}),'
          f' blocks padded {sorted(pads)}, bytes {len(T.dec)}->{len(out)}')

if __name__ == '__main__':
    main()
