#!/usr/bin/env python3
"""Read-only, index-selective original WZM LJBC proto field/call/branch reader.

Run with an existing extracted .ljbc. KGC strings are reverse-serialized,
WZM's opaque type-4 values are represented as hashes, not invented API names.
This tool does not execute bytecode or change any game assets.
"""
import argparse
from pathlib import Path
from ljbc_proto_inspect import protos, uleb

def read_table_value(data, p):
    t, p = uleb(data, p)
    if t == 0: return "nil", p
    if t == 1: return "false", p
    if t == 2: return "true", p
    if t == 3:
        n, p = uleb(data, p)
        return f"int({n})", p
    if t in (4, 5):
        xs = []
        for _ in range(3):
            v, p = uleb(data, p)
            xs.append(v)
        return f"opaque-{t}({xs[0]:x}:{xs[1]:x}:{xs[2]})", p
    if t >= 6:
        return data[p:p + t - 6].decode("utf8", "replace"), p + t - 6
    raise ValueError((t, p))

def get_consts(data, proto):
    p = proto["start"] + 4
    for _ in range(6):
        _, p = uleb(data, p)
    p += 4 * proto["nbc"] + 2 * proto["nups"]
    items = {}
    for k in range(proto["kgc"]-1, -1, -1):
        t, p = uleb(data, p)
        if t == 0: value = "CHILD"
        elif t == 1:
            arr, p = uleb(data, p)
            hash_n, p = uleb(data, p)
            a = []
            for _ in range(arr):
                v, p = read_table_value(data, p)
                a.append(v)
            h = []
            for _ in range(hash_n):
                k1, p = read_table_value(data, p)
                v1, p = read_table_value(data, p)
                h.append((k1,v1))
            value = {"array":a, "hash":h}
        elif t in (4, 5):
            xs = []
            for _ in range(3):
                v, p = uleb(data, p)
                xs.append(v)
            value = f"opaque-{t}({xs[0]:x}:{xs[1]:x}:{xs[2]})"
        elif t >= 6:
            value = data[p:p+t-6].decode("utf8", "replace")
            p += t-6
        else:
            raise ValueError(f"unknown KGC type {t} at {p:x}")
        items[k] = value
    kn = {}
    for i in range(proto["kn"]):
        n, p = uleb(data, p)
        kn[i] = n
    return items, kn, p

names = {
  0x0e:"IST",0x0f:"ISF",0x12:"MOV",0x15:"LEN",
  0x27:"KSTR",0x28:"KCDATA",0x2a:"KSHORT",0x2c:"KPRI",
  0x2e:"UGET",0x34:"FNEW",0x36:"TDUP",0x37:"GGET",0x38:"GSET",
  0x3b:"TGETV",0x3c:"TGETS",0x3d:"TGETB",0x3f:"TSETV",0x40:"TSETS",
  0x44:"CALLM",0x45:"CALL",0x46:"CALLMT",0x47:"CALLT",
  0x4e:"RET0",0x4f:"RET1",0x50:"FORI",0x52:"FORL",0x55:"ITERL",0x5b:"JMP",
}
def dump_rec(p, data, lo=0, hi=None, consts_only=False):
    kgc, kn, start_debug = get_consts(data,p)
    print(f"PROTO#{p['seq']} payload={p['start']:#x}..{p['end']:#x} firstline={p['firstline']} nbc={p['nbc']} params={p['nparams']} KGC={p['kgc']} KNUM={p['kn']} debug={p['debugsize']}")
    for k in sorted(kgc):
        v=kgc[k]
        if isinstance(v,dict):
            v="TABLE array="+repr(v["array"][:32])+" hash="+repr(v["hash"][:16])
        print(f"  KGC[{k:3}] {str(v)[:180]}")
    print("  KNUM",kn)
    if consts_only: return
    debug = data[start_debug: start_debug+p["nbc"]] if p['debugsize']==p['nbc'] else None
    for pc in range(lo, min(hi or p["nbc"],p["nbc"])):
        w=int.from_bytes(p["bc"][pc*4:pc*4+4],"little")
        op=w&255; a=w>>8&255; b=w>>24&255; c=w>>16&255; d=w>>16
        kdesc=""
        if op in (0x27,0x28,0x34,0x36,0x37,0x38): kdesc=f" KGC[{d}]={str(kgc.get(d))[:85]}"
        if op in (0x3c,0x40): kdesc=f" KGC[{c}]={str(kgc.get(c))[:85]}"
        if op in (0x50,0x52,0x55,0x5b): kdesc+=f" ->PC{pc+1+d-0x8000}"
        ln=f"{p['firstline']+debug[pc]-1}" if debug else "?"
        print(f"PC{pc:4} line{ln:>4} {w:08x} {names.get(op,f'OP{op:02x}'):>7} A{a:2} B{b:3} C{c:3} D{d:05x}"+kdesc)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("path",type=Path)
    ap.add_argument("--proto",type=int,action="append",required=True)
    ap.add_argument("--lo",type=int,default=0)
    ap.add_argument("--hi",type=int)
    ap.add_argument("--consts-only",action="store_true")
    ar=ap.parse_args()
    data=ar.path.read_bytes()
    recs=list(protos(data))
    for seq in ar.proto:
        dump_rec(recs[seq],data,ar.lo,ar.hi,ar.consts_only)

if __name__ == "__main__":main()
