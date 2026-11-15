#!/usr/bin/env python3
"""Read-only inspector for zlib-wrapped LuaJIT bytecode in WZM fastfiles.

The original FF is never modified. Each accepted stream passes the zlib
checksum and ends at a valid stream boundary. Bytecode is catalogued as data;
the tool does not execute it. Deliberately avoid interpreting module names
from nearby compressed bytes or asserting a script loaded on the device.

Example:
  python3 analysis/ff_luajit_stream_index.py \
      analysis/reconstructed_core/zone/global.ff \
      --out analysis/runtime/ff_scripts/global_lua_index.json \
      --extract-match MainMenuMobile --extract-match FlowManager
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import zlib

MAGIC = b"\x1bLJ\x84\x18"
KNOWN_ZLIB_SECOND = frozenset((0x01, 0x5E, 0x9C, 0xDA))
MAX_COMPRESSED = 2_000_000
MAX_UNCOMPRESSED = 4_000_000


def iter_streams(data: bytes):
    for offset in range(len(data) - 5):
        if data[offset] != 0x78 or data[offset + 1] not in KNOWN_ZLIB_SECOND:
            continue
        if (data[offset] * 256 + data[offset + 1]) % 31:
            continue
        cap = min(MAX_COMPRESSED, len(data) - offset)
        try:
            decoder = zlib.decompressobj()
            content = decoder.decompress(memoryview(data)[offset:offset + cap], MAX_UNCOMPRESSED)
            if not decoder.eof or not content.startswith(MAGIC):
                continue
            length = cap - len(decoder.unused_data)
            if length <= 2:
                continue
        except zlib.error:
            continue
        yield offset, length, content


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fastfile", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--extract-match", action="append", default=[],
                        help="Export bytecode matching this exact ASCII substring")
    parser.add_argument("--max-export", type=int, default=50)
    args = parser.parse_args()
    data = args.fastfile.read_bytes()
    records = []
    args.out.parent.mkdir(parents=True, exist_ok=True)
    dump_dir = args.out.parent / (args.fastfile.stem + "_selected_lua")
    exported = 0
    needles = [s.encode() for s in args.extract_match]
    for offset, clen, content in iter_streams(data):
        found = [s for s, raw in zip(args.extract_match, needles) if raw in content]
        text_fields = [x.decode("ascii", "replace") for x in re.findall(rb"[ -~]{7,}", content)]
        item = {
            "offset": offset, "offset_hex": hex(offset),
            "compressed_bytes": clen, "uncompressed_bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
            "header": content[:8].hex(),
            "first_text_constants": text_fields[:9],
            "keyword_hits": found,
        }
        if found and exported < args.max_export:
            dump_dir.mkdir(parents=True, exist_ok=True)
            dest = dump_dir / f"bytecode_{offset:08x}.ljbc"
            if dest.exists():
                raise FileExistsError(f"Refusing to overwrite: {dest}")
            dest.write_bytes(content)
            item["extracted_file"] = str(dest)
            exported += 1
        records.append(item)
    result = {"input": str(args.fastfile), "sha256": hashlib.sha256(data).hexdigest(),
              "streams": len(records), "exported": exported, "records": records}
    if args.out.exists():
        raise FileExistsError(f"Refusing to overwrite: {args.out}")
    args.out.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Validated {len(records)} LuaJIT streams, extracted {exported}, indexed at {args.out}")


if __name__ == "__main__":
    main()
