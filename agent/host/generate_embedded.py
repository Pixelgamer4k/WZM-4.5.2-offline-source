#!/usr/bin/env python3
"""Pin and embed the ORIGINAL WZM 4.5.2 host/AI modules without runtime files.

The authoritative Mac TUI files and previous host-source port are READ ONLY.
This generator will refuse any altered upstream byte, missing expected marker,
or unexpected transform count. Only output inside this host directory changes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
POC = HERE.parents[2]  # agent/host inside isolated v4; authoritative POC stays read-only
TUI = POC.parent / 'WarzoneMobileOffline/analysis/frida_tools/lua_bridge'
PRIOR = POC / 'standalone_host_port_20261110'
OUTPUT = HERE / 'embedded_sources.js'

SOURCES = {
    'HOST_FUNCTION_SOURCE': (
        PRIOR / 'host_gadget_function.js',
        '58f2055121216d56e1d555ead15f828e2f11283c30a767e372509d46d3ca3bde',
    ),
    'PARTY_INJECTOR_SOURCE': (
        TUI / 'party_bot_inject.js',
        'fa72d57975b802e05dc8d8d88544618000850d780dffedd3ac2c12bd56fe23e1',
    ),
    'AI_CREATOR_SOURCE': (
        TUI / 'native_ai_both_sides.js',
        'c27fc54c334cc17c450a71d1eeea4abf432c40c28bf534407ca26cd402ff2c40',
    ),
    'AI_DIFFICULTY_GUARD_SOURCE': (
        TUI / 'native_ai_veteran_guard.js',
        'b63c44c77f03041f661046f95610b4022d3c71fbac8aced6ab7e8b3a2b3a2225',
    ),
}
MATCH_SOURCE = PRIOR / 'match_contract.js'
MATCH_SHA256 = 'ae16d6f9ea173af64c719a9eaf6b59dc5eac6285399370b5b980d0e970f8e27f'


def hash_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def replace_exact(value: str, old: str, new: str) -> str:
    count = value.count(old)
    if count != 1:
        raise ValueError(f'Expected exactly one source marker, found {count}: {old[:100]}')
    return value.replace(old, new, 1)


def build(verify=False) -> str:
    content = {}
    hashes = {}
    for name, (source, expected) in SOURCES.items():
        raw = source.read_bytes()
        actual = hash_bytes(raw)
        if actual != expected:
            raise ValueError(f'Refusing changed authoritative source {source}: {actual}')
        content[name] = raw.decode('utf-8')
        hashes[name] = {'original_sha256': actual, 'original_bytes': len(raw)}

    # Original host has two read-only/UI-diagnostic frame attachments, and one
    # embedded Lua match probe on the SAME native UI frame owned by the prior
    # Gadget boot supervisor. Keep probe logic, but let the existing owner call
    # it explicitly: NEVER install a second 0x337c1c0 Interceptor.
    host = content['HOST_FUNCTION_SOURCE']
    host = replace_exact(host, "['frame337c1c0',0x337c1c0],", '')
    host = replace_exact(host,
        '    Interceptor.attach(at(0x337c1c0),{onEnter(){',
        '    globalThis.WZM_HOST_MATCH_PROBE_FRAME = function() {')
    host = replace_exact(host,
        '    }});\n  }\n  let luaErrors',
        '    };\n  }\n  let luaErrors')
    if 'Interceptor.attach(at(0x337c1c0)' in host:
        raise ValueError('Competing original native LUI frame owner remains in host source')
    content['HOST_FUNCTION_SOURCE'] = host
    hashes['HOST_FUNCTION_SOURCE']['embedded_sha256'] = hash_bytes(host.encode('utf-8'))
    hashes['HOST_FUNCTION_SOURCE']['embedded_bytes'] = len(host.encode('utf-8'))

    # Original TUI ALWAYS runs party_bot_inject.js after clientEnterWorld and
    # BEFORE native_ai_both_sides.js. Its party part is a separate native
    # stage, not real AI. Retain its real server-thread pipeline but route its
    # once-only LUI action through the existing (single) native LUI owner.
    party=content['PARTY_INJECTOR_SOURCE']
    party=replace_exact(party,
        'Interceptor.attach(at(0x337c1c0),{onEnter(){',
        'globalThis.WZM_PARTY_INJECT_FRAME = function(){')
    party=replace_exact(party,
        '}});\n// Perf: runs every server tick;',
        '};\n// Perf: runs every server tick;')
    if 'Interceptor.attach(at(0x337c1c0)' in party:
        raise ValueError('Party injector still attaches competing LUI hook')
    content['PARTY_INJECTOR_SOURCE']=party
    hashes['PARTY_INJECTOR_SOURCE']['embedded_sha256']=hash_bytes(party.encode('utf-8'))
    hashes['PARTY_INJECTOR_SOURCE']['embedded_bytes']=len(party.encode('utf-8'))

    # Bot creator DOES call the native difficulty setter 0x265ea3c; modify its
    # argument and readback only, not native bytes or the server-veneer protocol.
    creator = content['AI_CREATOR_SOURCE']
    creator = replace_exact(
        creator,
        "const opt=globalThis.WZM_BOTH_SIDES_AI||{},goal=opt.count===undefined?6:opt.count;",
        "const opt=globalThis.WZM_BOTH_SIDES_AI||{},goal=opt.count===undefined?6:opt.count;\n"
        "const BOT_DIFF=opt.difficulty;\n"
        "if(!Number.isInteger(BOT_DIFF)||BOT_DIFF<0||BOT_DIFF>3)throw Error('AI difficulty must be 0..3');",
    )
    creator = replace_exact(creator, 'queue(0x265ea3c,[ai,ptr(3)])',
                            'queue(0x265ea3c,[ai,ptr(BOT_DIFF)])')
    creator = replace_exact(creator, "if(df!==3)throw Error('Veteran readback failed')",
                            "if(df!==BOT_DIFF)throw Error('native AI difficulty readback failed')")
    creator = replace_exact(creator, "s:'bothSidesVeteran'", "s:'bothSidesDifficulty'")
    content['AI_CREATOR_SOURCE'] = creator

    # Original persistent Veteran guard already reads WZM_BOT_DIFF and invokes
    # the native setter. Make only its feedback labels match the selected value.
    guard = content['AI_DIFFICULTY_GUARD_SOURCE']
    guard = replace_exact(guard, "label:'Veteran'",
                          "label:['Recruit','Regular','Hardened','Veteran'][BOT_DIFF]")
    guard = replace_exact(guard, "s:'veteranEnforced'", "s:'difficultyEnforced'")
    content['AI_DIFFICULTY_GUARD_SOURCE'] = guard

    for name in ('AI_CREATOR_SOURCE', 'AI_DIFFICULTY_GUARD_SOURCE'):
        hashes[name]['embedded_sha256'] = hash_bytes(content[name].encode('utf-8'))
        hashes[name]['embedded_bytes'] = len(content[name].encode('utf-8'))

    # Copy the original TUI pure-data match contract into THIS isolated host
    # directory, so the final rootless bundle has no sibling-file dependency.
    match_bytes = MATCH_SOURCE.read_bytes()
    if hash_bytes(match_bytes) != MATCH_SHA256:
        raise ValueError('Authoritative match_contract.js changed; review before regeneration')
    match_output = HERE / 'match_contract.js'
    if verify:
        if not match_output.is_file() or match_output.read_bytes() != match_bytes:
            raise ValueError('Original TUI match_contract snapshot missing or changed')
    elif not match_output.is_file() or match_output.read_bytes() != match_bytes:
        match_output.write_bytes(match_bytes)

    # These are executable original game hooks, not a newly invented host.
    # No Script.evaluate/load, filesystem reads or shell in the embedded data:
    # the owner must explicitly activate them AFTER verification and a click.
    lines = [
        '// Generated by generate_embedded.py; never modify by hand.',
        '// Source pins: original host_spawn.js via audited 20261110 Gadget port,',
        '// original native_ai_both_sides.js and native_ai_veteran_guard.js.',
    ]
    for name, value in content.items():
        lines.append('export const '+name+' = '+json.dumps(value, ensure_ascii=True)+';')
    lines.append('export const ORIGINAL_SOURCE_HASHES = Object.freeze('+json.dumps(hashes,sort_keys=True)+');')
    return '\n'.join(lines)+'\n'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify',action='store_true',
                        help='read-only byte comparison; do not regenerate files')
    args=parser.parse_args()
    data = build(verify=args.verify)
    if args.verify:
        if not OUTPUT.is_file() or OUTPUT.read_text() != data:
            raise ValueError('Generated standalone JS is stale or has been modified')
        print('PASS EXACT PINNED EMBEDDED HOST+AI SOURCES', OUTPUT,
              'SHA256',hash_bytes(data.encode()))
        return
    if OUTPUT.is_file() and OUTPUT.read_text() == data:
        print('UNCHANGED', OUTPUT)
        return
    OUTPUT.write_text(data)
    print('GENERATED', OUTPUT, len(data), 'bytes SHA256', hash_bytes(data.encode()))


if __name__ == '__main__':
    main()
