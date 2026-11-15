#!/usr/bin/env python3
"""emu.py — run WZM 4.5.2's own zone loader (DB_LoadXAssets 0x1aafb68) on a decoded zone, on the Mac (Unicorn).

Faked: raw stream read 0x199e98c, indirect stream reader object (0x635abb0), align 0x19a4bcc, block push/pop,
pointer-reference helpers, libc imports. Everything else is the game's own code.
Records every stream read (offset, size, loader call site) and every pointer the loaders store into structs.
usage: emu.py <decoded.bin> <out_prefix> [max_assets]
"""
import struct, sys, json
from unicorn import *
from unicorn.arm64_const import *

LIB = os.environ.get('WZM_LIBGAME', 'input/libgame.so')
E = open(LIB, 'rb').read()
STATE = 0x6724ca0           # DB stream state: +0x100 cursor, +0x188 current block
STREAMOBJ = 0x635abb0       # indirect stream reader object
STUBS = 0x0f000000          # import / fake function stubs
HEAP = 0x10000000           # block memory (stream data lands here)
import os
HEAP_SZ = int(os.environ.get("EMU_HEAP", "0x20000000"), 16)
STACK = 0x0e000000; STACK_SZ = 0x00800000
TLS = 0x0e900000
STOP = STUBS + 0xff000

def u64(b, o): return struct.unpack_from('<Q', b, o)[0]

class Emu:
    def __init__(s, dec):
        s.dec = dec; s.pos = 0; s.reads = []; s.unknown = {}
        u = s.u = Uc(UC_ARCH_ARM64, UC_MODE_ARM)
        u.mem_map(0, 0xde50000)
        phoff = u64(E, 0x20); phn = struct.unpack_from('<H', E, 0x38)[0]
        for i in range(phn):
            t, fl, off, va, pa, fs, ms, al = struct.unpack_from('<IIQQQQQQ', E, phoff + i * 56)
            if t == 1 and va < 0xde00000: u.mem_write(va, E[off:off + fs])
        for base, size in ((STUBS, 0x100000), (HEAP, HEAP_SZ), (STACK, STACK_SZ), (TLS, 0x10000)):
            u.mem_map(base, size)
        s.relocate()
        u.reg_write(UC_ARM64_REG_TPIDR_EL0, TLS)
        # fake functions: replace entry with 'ret' and handle in a code hook
        s.fakes = {0x199e98c: s.f_rawread, 0x19a4bcc: s.f_align, 0x19b5c2c: s.f_push, 0x19b5cb4: s.f_pop,
                   0x1aafa68: s.f_ref, 0x1aaf960: s.f_nop, 0x19a571c: s.f_nop, 0x19a57dc: s.f_nop,
                   0x1ab02f0: s.f_nop, 0x19aa118: s.f_ret0, 0x19aa134: s.f_ret0,
                   STUBS + 0x80000: s.f_streamobj}
        for a in s.fakes: u.mem_write(a, b'\xc0\x03\x5f\xd6')  # ret
        # indirect stream object -> vtable -> our fake
        u.mem_write(STREAMOBJ, struct.pack('<Q', STUBS + 0x81000))
        u.mem_write(STUBS + 0x81000, struct.pack('<Q', STUBS + 0x80000))
        u.mem_write(STATE + 0x100, struct.pack('<Q', HEAP))
        u.mem_write(STATE + 0x188, struct.pack('<I', 1))
        for a in s.fakes: u.hook_add(UC_HOOK_CODE, s.on_code, begin=a, end=a)
        u.hook_add(UC_HOOK_CODE, s.on_code, begin=STUBS, end=STUBS + 0x7ffff)
        s.skipped = {}
        s.assets = []; s.ptrs = []
        def onasset(u, addr, size, _):
            try: t = struct.unpack('<I', u.mem_read(s.x(1), 4))[0]
            except UcError: t = -1
            s.assets.append((len(s.reads), t))
        u.hook_add(UC_HOOK_CODE, onasset, begin=0x17a7880, end=0x17a7880)
        def onptr(u, acc, addr, size, val, _):
            if size == 8 and HEAP <= (val & 0xffffffffffffffff) < HEAP + HEAP_SZ: s.ptrs.append((addr, val, len(s.reads)))
        u.hook_add(UC_HOOK_MEM_WRITE, onptr, begin=HEAP, end=HEAP + HEAP_SZ - 0x200000)
        def wr(u, acc, addr, size, val, _):
            if size == 8 and (val & 0xffffffffffffffff) == 0xe000000000000000 and not getattr(s,'caught',None):
                s.caught = (hex(u.reg_read(UC_ARM64_REG_PC)), hex(addr), hex(u.reg_read(UC_ARM64_REG_SP)))
        u.hook_add(UC_HOOK_MEM_WRITE, wr, begin=STACK, end=STACK + STACK_SZ)
        u.hook_add(UC_HOOK_BLOCK, s.on_block, begin=0x10a6000, end=0x5336000)

    def relocate(s):
        e = E; shoff = u64(e, 0x28); shn = struct.unpack_from('<H', e, 0x3c)[0]; she = struct.unpack_from('<H', e, 0x3a)[0]
        secs = [struct.unpack_from('<IIQQQQIIQQ', e, shoff + i * she) for i in range(shn)]
        dynsym = [x for x in secs if x[1] == 11][0]; dynstr = secs[dynsym[6]]
        def symname(i):
            o = dynsym[4] + i * 24; n = struct.unpack_from('<I', e, o)[0]; so = dynstr[4] + n
            return e[so:e.index(b'\0', so)].decode()
        s.stubnames = {}; nxt = 0
        for sec in secs:
            if sec[1] != 4: continue
            off, size = sec[4], sec[5]
            for j in range(0, size, 24):
                r_off, info, add = struct.unpack_from('<QQq', e, off + j)
                typ = info & 0xffffffff; sym = info >> 32
                if r_off >= 0xde00000: continue
                if typ == 0x403: s.u.mem_write(r_off, struct.pack('<q', add))
                elif typ in (0x401, 0x402, 0x101):
                    nm = symname(sym); a = STUBS + nxt * 4; nxt += 1
                    s.stubnames[a] = nm; s.u.mem_write(a, b'\xc0\x03\x5f\xd6')
                    s.u.mem_write(r_off, struct.pack('<Q', a + add if typ == 0x101 else a))

    # ---- fakes ----
    def x(s, n): return s.u.reg_read(UC_ARM64_REG_X0 + n) if n < 29 else None
    def f_nop(s): pass
    def curblk(s): return struct.unpack('<i', s.u.mem_read(STATE + 0x188, 4))[0]
    def f_push(s):
        m = s.x(0) & 0xffffffff
        m = 15 if m == 9 else m; m = 14 if m == 13 else m; m = 4 if m == 5 else m; m = 15 if m == 14 else m; m = 3 if m == 4 else m
        s.bstack = getattr(s, 'bstack', []); s.bstack.append(s.curblk()); s.u.mem_write(STATE + 0x188, struct.pack('<i', m))
    def f_pop(s):
        s.u.mem_write(STATE + 0x188, struct.pack('<i', s.bstack.pop() if getattr(s, 'bstack', None) else 1))
    def f_ref(s):
        s.refs = getattr(s, 'refs', []); s.refs.append((s.x(0), s.x(1), len(s.reads), s.pos, s.curblk()))
    def f_ret0(s): s.u.reg_write(UC_ARM64_REG_X0, 0)
    def copy(s, dst, size, site):
        if s.curblk() == 11:
            s.u.mem_write(dst, b'\0' * size); return
        if STACK <= dst < STACK + STACK_SZ: s.stackreads = getattr(s,'stackreads',[]) + [(hex(dst), size, hex(site), hex(s.u.reg_read(UC_ARM64_REG_SP)), hex(s.u.reg_read(UC_ARM64_REG_LR)))]
        s.u.mem_write(dst, s.dec[s.pos:s.pos + size]); s.reads.append((s.pos, size, site, dst, s.curblk())); s.pos += size
    def f_rawread(s):
        fp = s.u.reg_read(UC_ARM64_REG_X29)
        site = struct.unpack('<Q', s.u.mem_read(fp + 8, 8))[0]
        s.copy(s.x(0), s.x(1), site)
    def f_streamobj(s):
        size = struct.unpack('<Q', s.u.mem_read(s.x(3), 8))[0]; dst = struct.unpack('<Q', s.u.mem_read(s.x(2), 8))[0]
        site = s.u.reg_read(UC_ARM64_REG_LR)
        s.copy(dst, size, site)
        cur = struct.unpack('<Q', s.u.mem_read(STATE + 0x100, 8))[0]
        if cur == dst: s.u.mem_write(STATE + 0x100, struct.pack('<Q', cur + size))
        s.u.reg_write(UC_ARM64_REG_X0, 1)
    def f_align(s):
        m = s.x(0) & 0xffffffff
        cur = struct.unpack('<Q', s.u.mem_read(STATE + 0x100, 8))[0]
        s.u.mem_write(STATE + 0x100, struct.pack('<Q', (cur + m) & ~m))

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

    ALLOW = ((0x16b0000, 0x17b0000), (0x1aaf000, 0x1ab5000), (0x1aace4c, 0x1aacf00))
    def on_block(s, u, addr, size, _):
        s.prev2=getattr(s,'prev',0);s.prev=addr
        if addr in s.fakes: return
        for a, b in s.ALLOW:
            if a <= addr < b: return
        # outside loader code: return 0 to the caller immediately
        s.skipped[addr] = s.skipped.get(addr, 0) + 1
        u.reg_write(UC_ARM64_REG_X0, 0); u.reg_write(UC_ARM64_REG_PC, u.reg_read(UC_ARM64_REG_LR))

    def run(s, max_assets=None):
        u = s.u; ctx = HEAP + HEAP_SZ - 0x100000; lst = ctx + 0x1000
        u.mem_write(ctx, b'\0' * 0x400)
        sp = STACK + STACK_SZ - 0x1000
        u.reg_write(UC_ARM64_REG_SP, sp); u.reg_write(UC_ARM64_REG_LR, STOP)
        u.mem_write(STOP, b'\xc0\x03\x5f\xd6')
        for i, v in enumerate((ctx, lst, 0, 0)): u.reg_write(UC_ARM64_REG_X0 + i, v)
        try:
            u.emu_start(0x1aafb68, STOP)
            s.err = None
        except UcError as ex:
            s.err = f'{ex} at pc={u.reg_read(UC_ARM64_REG_PC):#x} lr={u.reg_read(UC_ARM64_REG_LR):#x} lastblock={getattr(s,"prev",0):#x} prev={getattr(s,"prev2",0):#x}'
        return s

if __name__ == '__main__':
    dec = open(sys.argv[1], 'rb').read(); out = sys.argv[2]
    em = Emu(dec).run()
    print('consumed', em.pos, 'of', len(dec), 'reads', len(em.reads), 'error', em.err)
    print('unknown imports', em.unknown, 'caught', getattr(em,'caught',None))
    print('stackreads', getattr(em,'stackreads',[])[-5:])
    print('skipped', sorted(em.skipped.items(), key=lambda x: -x[1])[:15])
    json.dump({'consumed': em.pos, 'reads': [r[:3] for r in em.reads], 'err': em.err}, open(out + '.json', 'w'))
    import pickle; pickle.dump({'reads': em.reads, 'assets': em.assets, 'ptrs': em.ptrs, 'refs': getattr(em,'refs',[])}, open(out + '.graph.pkl', 'wb'))
    print('assets', len(em.assets), 'pointer stores', len(em.ptrs), 'refs', len(getattr(em,'refs',[])))
