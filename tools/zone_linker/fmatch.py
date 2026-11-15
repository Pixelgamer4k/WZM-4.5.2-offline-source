#!/usr/bin/env python3
import os
"""fmatch.py — find a 4.5.2 libgame function's counterpart in another libgame build.

Instruction words are masked (branch/adrp/literal targets, optionally load/store/add immediates) and the masked
sequence of the source function is searched in the other build's executable segment.
usage: fmatch.py <other_libgame.so> <va> [<va> ...]
"""
import struct, sys
import numpy as np

SRC = os.environ.get('WZM_LIBGAME', 'input/libgame.so')


def load(path):
    e = open(path, 'rb').read()
    phoff = struct.unpack_from('<Q', e, 0x20)[0]; phn = struct.unpack_from('<H', e, 0x38)[0]
    for i in range(phn):
        t, fl, off, va, pa, fs, ms, al = struct.unpack_from('<IIQQQQQQ', e, phoff + i * 56)
        if t == 1 and fl & 1:
            w = np.frombuffer(e[off:off + fs - fs % 4], dtype='<u4')
            return e, va, w
    raise SystemExit('no exec segment')


def mask(w, loose):
    w = w.astype(np.uint32)
    m = np.full(w.shape, 0xffffffff, dtype=np.uint32)
    def sel(andm, val, keep):
        idx = (w & np.uint32(andm)) == np.uint32(val)
        m[idx] = np.uint32(keep)
    sel(0x7c000000, 0x14000000, 0xfc000000)  # B / BL
    sel(0x1f000000, 0x10000000, 0x9f00001f)  # ADR / ADRP
    sel(0xff000010, 0x54000000, 0xff00001f)  # B.cond
    sel(0x7e000000, 0x34000000, 0xff00001f)  # CBZ/CBNZ
    sel(0x7e000000, 0x36000000, 0xfff8001f)  # TBZ/TBNZ
    sel(0x3b000000, 0x18000000, 0xff00001f)  # LDR literal
    if loose:
        sel(0x3b000000, 0x39000000, 0xffc003ff)  # LDR/STR unsigned imm
        sel(0x1f000000, 0x11000000, 0xffc003ff)  # ADD/SUB imm
        sel(0x3a000000, 0x28000000, 0xffc07fff)  # LDP/STP
        sel(0x1f800000, 0x12800000, 0xff80001f)  # MOVN/MOVZ/MOVK
    return w & m


def find(src_words, src_base, dst_words, dst_masked_cache, va, n=24, loose=False):
    i = (va - src_base) // 4
    seq = mask(src_words[i:i + n], loose)
    dm = dst_masked_cache[loose]
    cand = np.nonzero(dm == seq[0])[0]
    hits = []
    for c in cand:
        if c + n <= len(dm) and np.array_equal(dm[c:c + n], seq):
            hits.append(c)
            if len(hits) > 8: break
    return hits


def main():
    other = sys.argv[1]
    _, sbase, sw = load(SRC)
    _, dbase, dw = load(other)
    cache = {False: mask(dw, False), True: mask(dw, True)}
    for a in sys.argv[2:]:
        va = int(a, 16)
        res = None
        for loose in (False, True):
            for n in (32, 24, 16, 12, 8):
                h = find(sw, sbase, dw, cache, va, n, loose)
                if len(h) == 1:
                    res = (hex(dbase + h[0] * 4), n, 'loose' if loose else 'strict'); break
                if h and n == 8 and res is None:
                    res = ('ambiguous', [hex(dbase + x * 4) for x in h[:6]], 'loose' if loose else 'strict')
            if res and res[0] != 'ambiguous': break
        print(hex(va), '->', res)


if __name__ == '__main__':
    main()
