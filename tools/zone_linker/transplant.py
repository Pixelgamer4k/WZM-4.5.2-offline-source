#!/usr/bin/env python3
"""Transplant assets between two decoded v25 zones (same game build).

usage: transplant.py <spec.json>
spec: {
  "target": "work/nuketown",            # dir with decoded.bin, prefix.bin, emu.graph.pkl
  "donor":  "work/downtown",
  "insert": [donor asset index, ...],   # copied into the target, appended to the end of their type group
  "replace": [[target_idx, donor_idx, keep_target_hash], ...],  # asset body swapped in place
  "map_ents_add": optional path to a bin of 88-byte records appended to map_ents,
  "block_pad": {"1": 65536, "3": 65536, "15": 65536},
  "out": "work/nuketown/decoded_xxx.bin", "out_prefix": "work/nuketown/prefix_xxx.bin"
}
Asset list: decoded +16 u64 count; entries of 16 B (u64 type, u64 -1) after the string table.
Asset data is position independent (refs are 61-bit name hashes), so whole asset byte ranges can be moved.
"""
import json, pickle, struct, sys

def load(d):
    dec = open(f'{d}/decoded.bin', 'rb').read()
    G = pickle.load(open(f'{d}/emu.graph.pkl', 'rb'))
    R, A = G['reads'], G['assets']
    st = [R[a[0]][0] for a in A] + [len(dec)]
    return dec, G, R, A, st

def main():
    S = json.load(open(sys.argv[1]))
    tdec, TG, TR, TA, tst = load(S['target'])
    ddec, DG, DR, DA, dst = load(S['donor'])
    n_assets = struct.unpack_from('<Q', tdec, 16)[0]
    assert n_assets == len(TA), (n_assets, len(TA))
    # asset list location: the read with the big header list (count*16 bytes)
    lst = [r for r in TR[:TA[0][0]] if r[1] == n_assets * 16]
    assert len(lst) == 1, 'asset list read not found'
    list_off = lst[0][0]
    types = [struct.unpack_from('<Q', tdec, list_off + 16 * i)[0] for i in range(n_assets)]
    assert all(types[i] == TA[i][1] for i in range(n_assets)), 'asset list types differ from emu types'

    body = {i: tdec[tst[i]:tst[i + 1]] for i in range(n_assets)}
    for ti, di, keep in S.get('replace', []):
        nb = bytearray(ddec[dst[di]:dst[di + 1]])
        assert DA[di][1] == TA[ti][1], 'type mismatch'
        if keep: nb[0:8] = tdec[tst[ti]:tst[ti] + 8]
        body[ti] = bytes(nb)
    # build new order: target assets, with inserts placed after the last target asset of the same type
    ins = {}
    for di in S.get('insert', []):
        t = DA[di][1]
        last = max(i for i in range(n_assets) if TA[i][1] == t)
        ins.setdefault(last, []).append(di)
    order = []
    for i in range(n_assets):
        order.append(('t', i))
        for di in ins.get(i, []): order.append(('d', di))
    if S.get('map_ents_add'):
        me = [i for i in range(n_assets) if TA[i][1] == 40][0]
        ra = TA[me][0]; rp = TR[ra][0]
        bp, bs = TR[ra + 315][0], TR[ra + 315][1]
        add = open(S['map_ents_add'], 'rb').read(); assert len(add) % 88 == 0
        b = bytearray(body[me]); cnt = struct.unpack_from('<I', b, 0x300)[0]
        o = bp + bs - tst[me]
        b = b[:o] + add + b[o:]; struct.pack_into('<I', b, 0x300, cnt + len(add) // 88)
        body[me] = bytes(b)
    head = bytearray(tdec[:tst[0]])
    new_types = [TA[i][1] if k == 't' else DA[i][1] for k, i in order]
    struct.pack_into('<Q', head, 16, len(order))
    lst_bytes = b''.join(struct.pack('<Qq', t, -1) for t in new_types)
    head = head[:list_off] + lst_bytes + head[list_off + n_assets * 16:]
    out = bytes(head) + b''.join(body[i] if k == 't' else ddec[dst[i]:dst[i + 1]] for k, i in order)
    open(S['out'], 'wb').write(out)
    pre = bytearray(open(f"{S['target']}/prefix.bin", 'rb').read())
    for b, pad in S.get('block_pad', {}).items():
        o = 0x40 + 8 * (int(b) + 1)
        struct.pack_into('<Q', pre, o, struct.unpack_from('<Q', pre, o)[0] + pad)
    open(S['out_prefix'], 'wb').write(pre)
    print('assets', n_assets, '->', len(order), 'bytes', len(tdec), '->', len(out))

if __name__ == '__main__':
    main()
