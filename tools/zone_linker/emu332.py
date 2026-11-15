#!/usr/bin/env python3
"""emu332.py — run WZM 3.3.2's own zone loader (DB_LoadXAssets 0xf3f1c4) on a decoded v23 zone (Unicorn).

Same idea as emu.py (4.5.2). Addresses found 11 Nov 2026 with callg.py:
  DB_LoadXAssets 0xf3f1c4 (x1 = XAssetList*, w3 flag); Load_XAsset 0x35c6f90 (type at [[0xdb42628]]);
  Load_Stream 0xf3eb38(atStart w0, dst x1, size x2) -> raw read 0x21e56d4 / 0x21e3e98 (obj, dst, size);
  push block 0xf3e6a4, pop 0xf3e73c (native); alloc/align 0x21e7f08(mask);
  stream state 0x5477f88 (+0x100 cursor, +0x188 block, +0x590 depth) — same layout as 4.5.2.
usage: emu332.py <decoded.bin> <out_prefix>
"""
import struct, sys, json, os, pickle
from unicorn import *
from unicorn.arm64_const import *

LIB = os.environ.get('WZM_LIBGAME_332', 'input_332/libgame.so')
E = open(LIB, 'rb').read()
STATE = 0x5477f88
STREAMOBJ_GLOBAL = 0x5478520
VARXASSET = 0xdb42628
DB_LOADXASSETS = 0xf3f1c4
LOAD_XASSET = 0x35c6f90
MAPTOP = 0xea00000
STUBS = 0x0f000000
HEAP = 0x10000000
HEAP_SZ = int(os.environ.get("EMU_HEAP", "0x20000000"), 16)
STACK = 0x31000000; STACK_SZ = 0x00800000
TLS = STACK + STACK_SZ
STOP = STUBS + 0xff000
FAKEOBJ = STUBS + 0x90000


def u64(b, o): return struct.unpack_from('<Q', b, o)[0]


class Emu:
    ALLOW = ((0x3590000, 0x38b0000), (0xf3e600, 0xf3f9ac), (0x21e88c4, 0x21e8994), (0x5090000, 0x50a25a0))

    def __init__(s, dec):
        s.dec = dec; s.pos = 0; s.reads = []; s.unknown = {}; s.skipped = {}
        s.assets = []; s.ptrs = []; s.refs = []
        u = s.u = Uc(UC_ARCH_ARM64, UC_MODE_ARM)
        u.mem_map(0, MAPTOP)
        phoff = u64(E, 0x20); phn = struct.unpack_from('<H', E, 0x38)[0]
        for i in range(phn):
            t, fl, off, va, pa, fs, ms, al = struct.unpack_from('<IIQQQQQQ', E, phoff + i * 56)
            if t == 1 and va + fs <= MAPTOP: u.mem_write(va, E[off:off + fs])
        for base, size in ((STUBS, 0x100000), (HEAP, HEAP_SZ), (STACK, STACK_SZ), (TLS, 0x10000)):
            u.mem_map(base, size)
        s.relocate()
        u.reg_write(UC_ARM64_REG_TPIDR_EL0, TLS)
        s.fakes = {0x21e56d4: s.f_rawread, 0x21e3e98: s.f_rawread, 0x21e7f08: s.f_alloc}
        for a in s.fakes: u.mem_write(a, b'\xc0\x03\x5f\xd6')
        # stream object: +0x730 != 0 selects 0x21e56d4(obj, dst, size)
        u.mem_write(FAKEOBJ, b'\0' * 0x1000); u.mem_write(FAKEOBJ + 0x730, struct.pack('<I', 1))
        u.mem_write(STREAMOBJ_GLOBAL, struct.pack('<Q', FAKEOBJ))
        # each block has its own cursor (+0x108 + 8*block); the native push/pop switch between them
        s.BLK = BLK = (HEAP_SZ - 0x200000) // 16 & ~0xfff
        for b in range(16): u.mem_write(STATE + 0x108 + 8 * b, struct.pack('<Q', HEAP + b * BLK))
        u.mem_write(STATE + 0x100, struct.pack('<Q', HEAP + 1 * BLK))
        u.mem_write(STATE + 0x188, struct.pack('<I', 1))
        for a in s.fakes: u.hook_add(UC_HOOK_CODE, s.on_code, begin=a, end=a)
        u.hook_add(UC_HOOK_CODE, s.on_code, begin=STUBS, end=STUBS + 0x7ffff)

        def onasset(u, addr, size, _):
            try: t = struct.unpack('<I', u.mem_read(struct.unpack('<Q', u.mem_read(VARXASSET, 8))[0], 4))[0]
            except UcError: t = -1
            s.assets.append((len(s.reads), t))
        u.hook_add(UC_HOOK_CODE, onasset, begin=LOAD_XASSET, end=LOAD_XASSET)

        def onptr(u, acc, addr, size, val, _):
            if size == 8 and HEAP <= (val & 0xffffffffffffffff) < HEAP + HEAP_SZ: s.ptrs.append((addr, val, len(s.reads)))
        u.hook_add(UC_HOOK_MEM_WRITE, onptr, begin=HEAP, end=HEAP + HEAP_SZ - 0x200000)
        u.hook_add(UC_HOOK_BLOCK, s.on_block, begin=0xe2d000, end=0x50a25a0)

    def relocate(s):
        e = E; shoff = u64(e, 0x28); shn = struct.unpack_from('<H', e, 0x3c)[0]; she = struct.unpack_from('<H', e, 0x3a)[0]
        secs = [struct.unpack_from('<IIQQQQIIQQ', e, shoff + i * she) for i in range(shn)]
        dynsym = [x for x in secs if x[1] == 11][0]; dynstr = secs[dynsym[6]]
        def symname(i):
            o = dynsym[4] + i * 24; n = struct.unpack_from('<I', e, o)[0]; so = dynstr[4] + n
            return e[so:e.index(b'\0', so)].decode()
        s.stubnames = {}; nxt = 0; s.relcount = 0
        for sec in secs:
            if sec[1] != 4: continue
            off, size = sec[4], sec[5]
            for j in range(0, size, 24):
                r_off, info, add = struct.unpack_from('<QQq', e, off + j)
                typ = info & 0xffffffff; sym = info >> 32
                if r_off >= MAPTOP: continue
                if typ == 0x403: s.u.mem_write(r_off, struct.pack('<q', add)); s.relcount += 1
                elif typ in (0x401, 0x402, 0x101):
                    nm = symname(sym); a = STUBS + nxt * 4; nxt += 1
                    s.stubnames[a] = nm; s.u.mem_write(a, b'\xc0\x03\x5f\xd6')
                    s.u.mem_write(r_off, struct.pack('<Q', a + add if typ == 0x101 else a))

    def x(s, n): return s.u.reg_read(UC_ARM64_REG_X0 + n)
    def curblk(s): return struct.unpack('<i', s.u.mem_read(STATE + 0x188, 4))[0]
    def cursor(s): return struct.unpack('<Q', s.u.mem_read(STATE + 0x100, 8))[0]

    def f_rawread(s):
        dst, size = s.x(1), s.x(2) & 0xffffffff
        site = s.u.reg_read(UC_ARM64_REG_LR)
        fp = s.u.reg_read(UC_ARM64_REG_X29)
        try: site2 = struct.unpack('<Q', s.u.mem_read(fp + 8, 8))[0]   # caller of Load_Stream
        except UcError: site2 = 0
        s.u.mem_write(dst, s.dec[s.pos:s.pos + size])
        s.reads.append((s.pos, size, site2, dst, s.curblk())); s.pos += size

    def f_alloc(s):
        m = s.x(0) & 0xffffffff
        c = (s.cursor() + m) & ~m
        s.u.mem_write(STATE + 0x100, struct.pack('<Q', c))
        s.u.reg_write(UC_ARM64_REG_X0, c)

    def libc(s, nm):
        u = s.u; x0, x1, x2 = s.x(0), s.x(1), s.x(2)
        if nm in ('memset', '__memset_chk'): u.mem_write(x0, bytes([x1 & 0xff]) * x2)
        elif nm in ('memcpy', 'memmove', '__memcpy_chk', '__memmove_chk'): u.mem_write(x0, bytes(u.mem_read(x1, x2)))
        elif nm in ('strlen', '__strlen_chk'):
            n = 0
            while u.mem_read(x0 + n, 1) != b'\0': n += 1
            u.reg_write(UC_ARM64_REG_X0, n)
        else:
            s.unknown[nm] = s.unknown.get(nm, 0) + 1; u.reg_write(UC_ARM64_REG_X0, 0)

    def on_code(s, u, addr, size, _):
        if addr in s.fakes: s.fakes[addr]()
        elif addr in s.stubnames: s.libc(s.stubnames[addr])

    def on_block(s, u, addr, size, _):
        s.prev2 = getattr(s, 'prev', 0); s.prev = addr
        if addr in s.fakes: return
        for a, b in s.ALLOW:
            if a <= addr < b: return
        s.skipped[addr] = s.skipped.get(addr, 0) + 1
        u.reg_write(UC_ARM64_REG_X0, 0); u.reg_write(UC_ARM64_REG_PC, u.reg_read(UC_ARM64_REG_LR))

    def run(s):
        u = s.u; ctx = HEAP + HEAP_SZ - 0x100000; lst = ctx + 0x1000
        u.mem_write(ctx, b'\0' * 0x2000)
        u.reg_write(UC_ARM64_REG_SP, STACK + STACK_SZ - 0x1000); u.reg_write(UC_ARM64_REG_LR, STOP)
        u.mem_write(STOP, b'\xc0\x03\x5f\xd6')
        for i, v in enumerate((ctx, lst, 0, 0)): u.reg_write(UC_ARM64_REG_X0 + i, v)
        try:
            u.emu_start(DB_LOADXASSETS, STOP); s.err = None
        except UcError as ex:
            s.err = f'{ex} at pc={u.reg_read(UC_ARM64_REG_PC):#x} lr={u.reg_read(UC_ARM64_REG_LR):#x} last={getattr(s,"prev",0):#x} prev={getattr(s,"prev2",0):#x}'
        return s


if __name__ == '__main__':
    dec = open(sys.argv[1], 'rb').read(); out = sys.argv[2]
    em = Emu(dec).run()
    print('consumed', em.pos, 'of', len(dec), 'reads', len(em.reads), 'error', em.err)
    print('unknown imports', em.unknown)
    print('skipped', [(hex(a), n) for a, n in sorted(em.skipped.items(), key=lambda x: -x[1])[:20]])
    from collections import Counter
    print('assets', len(em.assets), 'types', Counter(t for _, t in em.assets).most_common(12), 'ptr stores', len(em.ptrs))
    json.dump({'consumed': em.pos, 'reads': [r[:3] for r in em.reads], 'err': em.err}, open(out + '.json', 'w'))
    pickle.dump({'reads': em.reads, 'assets': em.assets, 'ptrs': em.ptrs}, open(out + '.graph.pkl', 'wb'))
