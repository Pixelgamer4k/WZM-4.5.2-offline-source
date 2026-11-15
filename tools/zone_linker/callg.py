#!/usr/bin/env python3
"""callg.py — tiny call-graph helper for a libgame build.
usage: callg.py <lib> callers <va>        list BL sites calling va
       callg.py <lib> calls <va> [n]      list BL targets in the n instructions from va (default 400, stops at ret... no)
       callg.py <lib> dis <va> [n]        disassemble
"""
import struct, sys
import numpy as np
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM


def load(path):
    e = open(path, 'rb').read()
    phoff = struct.unpack_from('<Q', e, 0x20)[0]; phn = struct.unpack_from('<H', e, 0x38)[0]
    for i in range(phn):
        t, fl, off, va, pa, fs, ms, al = struct.unpack_from('<IIQQQQQQ', e, phoff + i * 56)
        if t == 1 and fl & 1:
            return e, va, off, np.frombuffer(e[off:off + fs - fs % 4], dtype='<u4')


def bl_targets(base, w):
    idx = np.nonzero((w & 0xfc000000) == 0x94000000)[0]
    imm = (w[idx] & 0x03ffffff).astype(np.int64)
    imm = np.where(imm & 0x02000000, imm - 0x04000000, imm)
    return idx, base + idx * 4 + imm * 4


def main():
    lib, cmd, va = sys.argv[1], sys.argv[2], int(sys.argv[3], 16)
    e, base, off, w = load(lib)
    if cmd == 'callers':
        idx, tg = bl_targets(base, w)
        for i in idx[tg == va]: print(hex(base + i * 4))
    else:
        n = int(sys.argv[4]) if len(sys.argv) > 4 else 400
        md = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
        o = off + (va - base)
        for ins in md.disasm(e[o:o + n * 4], va):
            if cmd == 'dis': print(hex(ins.address), ins.mnemonic, ins.op_str)
            elif ins.mnemonic == 'bl': print(hex(ins.address), ins.op_str)


if __name__ == '__main__':
    main()
