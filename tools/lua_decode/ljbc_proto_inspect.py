#!/usr/bin/env python3
"""Statically inspect source line ranges and bytecode of extracted WZM LuaJIT.

This is deliberately a structural parser, not a decompiler. Opcode labels
remain tentative because WZM's LuaJIT bytecode enum differs from upstream.
Input must be original, previously extracted unmodified `.ljbc` bytes.
"""

from __future__ import annotations
import argparse
from pathlib import Path
import re

MAGIC = b"\x1bLJ\x84\x18"
HINTS = {0x12: "MOV-like", 0x37: "GGET-like", 0x3c: "TGETS-like",
         0x45: "CALL-like", 0x2c: "KPRI-like", 0x4f: "RET1-like",
         0x4e: "RET0-like", 0x5b: "JMP-like", 0x0b: "primitive compare-like"}


def uleb(data, pos):
    v = 0
    shift = 0
    for _ in range(10):
        assert pos < len(data), "truncated ULEB"
        c = data[pos]
        pos += 1
        v |= (c & 0x7f) << shift
        if c < 128:
            return v, pos
        shift += 7
    raise ValueError("ULEB too long")


def protos(data):
    assert data.startswith(MAGIC), "not a supported recovered LuaJIT header"
    pos, seq = 5, 0
    while pos < len(data):
        length, start = uleb(data, pos)
        if length == 0:
            assert start == len(data), "trailing bytes after terminator"
            return
        end = start + length
        assert end <= len(data), "proto exceeds asset bounds"
        flags, nparams, framesize, nups = data[start:start + 4]
        p = start + 4
        nkgc, p = uleb(data, p)
        nkn, p = uleb(data, p)
        nbc, p = uleb(data, p)
        ndbg, p = uleb(data, p)
        firstline, p = uleb(data, p)
        numlines, p = uleb(data, p)
        bc = data[p:p + 4*nbc]
        assert len(bc) == nbc * 4 and p + 4*nbc + 2*nups <= end
        constants = [s.decode("utf8", "replace") for s in
                     re.findall(rb"[ -~]{5,}", data[p + 4*nbc + 2*nups:end])]
        yield {"seq":seq, "start":start, "end":end, "firstline":firstline,
               "numlines":numlines, "nparams":nparams, "framesize":framesize,
               "nups":nups, "kgc":nkgc, "kn":nkn, "nbc":nbc,
               "debugsize":ndbg, "bc":bc, "text":constants}
        pos, seq = end, seq + 1


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("bytecode_file", type=Path)
    ap.add_argument("--line", type=int, default=None)
    ap.add_argument("--keyword", action="append", default=[])
    ap.add_argument("--instructions", action="store_true")
    args = ap.parse_args()
    data = args.bytecode_file.read_bytes()
    records = list(protos(data))
    print(f"{args.bytecode_file}: {len(records)} validated proto boundaries")
    for p in records:
        if args.line is not None and p["firstline"] != args.line:
            continue
        if args.keyword and not any(k.casefold() in " ".join(p["text"]).casefold()
                                    for k in args.keyword):
            continue
        print(f"PROTO #{p['seq']} at {p['start']:#x}, "
              f"lines {p['firstline']}..{p['firstline']+p['numlines']-1}, "
              f"params {p['nparams']}, bc={p['nbc']}, constants={p['kgc']}, "
              f"upvalues={p['nups']}")
        print("  strings:", ", ".join(repr(x[:75]) for x in p["text"][:80]))
        if args.instructions:
            for i in range(0, len(p["bc"]), 4):
                w = int.from_bytes(p["bc"][i:i+4], "little")
                op = w & 0xff
                d = (w >> 16) & 0xffff
                hint = HINTS.get(op, "")
                jump = f" ->PC={i//4+1+d-0x8000}" if op == 0x5b else ""
                print(f"  {i//4:4d} {w:08x} op={op:02x} "
                      f"A={(w>>8)&0xff} B={(w>>24)&0xff} "
                      f"C={(w>>16)&0xff} D={d:04x} {hint}{jump}")


if __name__ == "__main__":
    main()
