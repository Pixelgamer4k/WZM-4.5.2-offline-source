#!/usr/bin/env python3
"""Targeted Android binary manifest edit for this owner-held split APK.

Adds only a declared signature-level controller permission and sets
extractNativeLibs=true to support compressed Frida Gadget libraries.
All other manifest chunks (including resource maps) remain byte-identical.
No game assets or APKs are copied by this utility.
"""
import argparse
import struct
from pathlib import Path

PERMISSION = 'com.wzm.offline.permission.CONTROL'


def get16(data, pos):
    return struct.unpack_from('<H', data, pos)[0]


def get32(data, pos):
    return struct.unpack_from('<I', data, pos)[0]


def set32(data, pos, number):
    struct.pack_into('<I', data, pos, number)


def read_utf16_length(data, pos):
    a = get16(data, pos)
    if a & 0x8000:
        return ((a & 0x7fff) << 16) | get16(data, pos + 2), pos + 4
    return a, pos + 2


def read_utf8_length(data, pos):
    a = data[pos]
    if a & 0x80:
        return ((a & 0x7f) << 8) | data[pos + 1], pos + 2
    return a, pos + 1


def read_pool(blob, start, size):
    n, style_count, flags, strings_start, styles_start = struct.unpack_from('<IIIII', blob, start + 8)
    if style_count or styles_start:
        raise ValueError('Styled AXML string pool unsupported')
    utf8 = bool(flags & 0x100)
    offsets = [get32(blob, start + 28 + i * 4) for i in range(n)]
    arr = []
    for offset in offsets:
        pos = start + strings_start + offset
        if utf8:
            _, pos = read_utf8_length(blob, pos)
            count, pos = read_utf8_length(blob, pos)
            arr.append(blob[pos:pos + count].decode('utf-8'))
        else:
            count, pos = read_utf16_length(blob, pos)
            arr.append(blob[pos:pos + count * 2].decode('utf-16-le'))
    return arr, utf8, strings_start, n


def add_to_pool(pool, new_string):
    if get16(pool, 0) != 1 or get16(pool, 2) != 28:
        raise ValueError('Unexpected AXML string pool')
    strings, utf8, start, n = read_pool(pool, 0, len(pool))
    if new_string in strings:
        return bytes(pool), strings.index(new_string), 0
    if utf8:
        codepoints = len(new_string)
        encoded = new_string.encode('utf-8')
        def leng(x):
            if x > 0x7fff: raise ValueError('String too long')
            return bytes([(x >> 8) | 0x80, x & 0xff]) if x > 0x7f else bytes([x])
        new_bytes = leng(codepoints) + leng(len(encoded)) + encoded + b'\x00'
    else:
        encoded = new_string.encode('utf-16-le')
        length = len(encoded) // 2
        if length >= 0x8000: raise ValueError('String too long')
        new_bytes = struct.pack('<H', length) + encoded + b'\x00\x00'
    existing_data = pool[start:]
    new_offset = len(existing_data)
    expanded = bytearray(pool[:start] + struct.pack('<I', new_offset) + existing_data + new_bytes)
    expanded.extend(b'\x00' * ((-len(expanded)) % 4))
    set32(expanded, 4, len(expanded))
    set32(expanded, 8, n + 1)
    set32(expanded, 20, start + 4)
    return bytes(expanded), n, len(expanded) - len(pool)


def chunks(data):
    pos = 8
    while pos < len(data):
        typ, hdr, size = struct.unpack_from('<HHI', data, pos)
        if size < hdr or hdr < 8 or pos + size > len(data):
            raise ValueError(f'Invalid chunk at {pos:x}')
        yield pos, typ, size
        pos += size
    if pos != len(data):
        raise ValueError('Incomplete binary manifest')


def attrs(data, start):
    first = get16(data, start + 24)
    width = get16(data, start + 26)
    count = get16(data, start + 28)
    if width != 20 or first != 20:
        raise ValueError('Unsupported AXML attribute layout')
    for i in range(count):
        yield start + 16 + first + i * width


def patch_manifest(data):
    if get16(data, 0) != 3 or get32(data, 4) != len(data):
        raise ValueError('Input is not an Android binary XML manifest')
    all_chunks = list(chunks(data))
    strings_chunk = next((c for c in all_chunks if c[1] == 1), None)
    if not strings_chunk: raise ValueError('Missing string pool')
    s_start, _, s_len = strings_chunk
    strings, _, _, _ = read_pool(data, s_start, s_len)
    if PERMISSION in strings:
        raise ValueError('Controller permission already exists; inspect input explicitly')
    original_perm_start = original_perm_end = None
    insert_after = None
    application_start = None
    for start, typ, size in all_chunks:
        if typ == 0x102:
            name_idx = get32(data, start + 20)
            name = strings[name_idx]
            if name == 'permission':
                attributes = [(a, strings[get32(data, a + 4)]) for a in attrs(data, start)]
                if any(key == 'protectionLevel' for _, key in attributes):
                    if original_perm_start is not None: raise ValueError('Multiple signature-permission templates')
                    original_perm_start = start
            elif name == 'application':
                if application_start is not None: raise ValueError('Multiple applications')
                application_start = start
        elif typ == 0x103 and original_perm_start is not None and insert_after is None:
            if strings[get32(data, start + 20)] == 'permission':
                original_perm_end = start + size
                insert_after = original_perm_end
    if original_perm_start is None or insert_after is None or application_start is None:
        raise ValueError('Permission template or application element missing')
    manifest = bytearray(data)
    original_entry = bytearray(data[original_perm_start:original_perm_end])
    start_el_size = get32(data, original_perm_start + 4)
    old_name = None
    for offset in attrs(original_entry, 0):
        attr_idx = get32(original_entry, offset + 4)
        if strings[attr_idx] == 'name':
            old_name = get32(original_entry, offset + 16)
            if get32(original_entry, offset + 8) != old_name or original_entry[offset + 15] != 3:
                raise ValueError('Unexpected template permission name encoding')
            break
    if old_name is None:raise ValueError('Template permission name missing')
    if get16(original_entry, start_el_size) != 0x103:
        raise ValueError('Permission is not a self-closing manifest child')
    # Edit only application extractNativeLibs, preserving the existing resource table.
    found_extraction = False
    for offset in attrs(manifest, application_start):
        if strings[get32(manifest, offset + 4)] == 'extractNativeLibs':
            if manifest[offset + 15] != 0x12:raise ValueError('Expected boolean extractNativeLibs')
            set32(manifest, offset + 16, 0xffffffff)
            found_extraction = True
    if not found_extraction: raise ValueError('Missing native extraction attribute')
    old_pool = bytes(manifest[s_start:s_start + s_len])
    new_pool, idx, _ = add_to_pool(old_pool, PERMISSION)
    for offset in attrs(original_entry, 0):
        if strings[get32(original_entry, offset + 4)] == 'name':
            set32(original_entry, offset + 8, idx)
            set32(original_entry, offset + 16, idx)
    # Insert a sibling after the existing permission node.
    payload = manifest[:insert_after] + original_entry + manifest[insert_after:]
    payload = payload[:s_start] + new_pool + payload[s_start + s_len:]
    set32(payload, 4, len(payload))
    assert len(payload) == get32(payload, 4)
    assert any(c[1] == 0x103 for c in chunks(payload))
    return bytes(payload)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('input',type=Path)
    p.add_argument('output',type=Path)
    args = p.parse_args()
    patched = patch_manifest(args.input.read_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(patched)
    print('Patched AXML manifest:', len(patched), 'bytes; permission:', PERMISSION)
