#!/usr/bin/env python3
"""Read-only privacy, archive-content and build-source syntax audit.

Reports filenames/counts only, never prints sensitive substrings or file contents.
Return nonzero when obvious privacy leaks, game binaries or source errors exist.
"""
from __future__ import annotations

import ast
import collections
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {'.git', '__pycache__', 'dist', 'frida_venv', 'runtime'}
BANNED_SUFFIXES = {'.apk','.so','.ff','.xpak','.xsub','.shard','.png','.jpg','.jpeg','.webp',
                   '.log','.logcat','.jsonl','.keystore','.der','.pkl','.pyc','.key','.pem',
                   '.idsig','.tar','.zip','.bin','.spv','.node'}


def source_files():
    files=[]
    for p in ROOT.rglob('*'):
        if not p.is_file():continue
        if set(p.relative_to(ROOT).parts).intersection(EXCLUDED_DIRS):continue
        files.append(p)
    return sorted(files)


def check_syntax(p, data, issues):
    rel=str(p.relative_to(ROOT))
    if p.suffix == '.py' and p.name != 'audit_source.py':
        try:ast.parse(data.decode('utf-8'),filename=rel)
        except (SyntaxError,UnicodeError) as e:issues.append((rel,'Invalid Python syntax/encoding'))
    if p.suffix == '.sh' or p.name in ('run.sh','setup_mac.sh','configure.sh'):
        if rel.startswith('analysis/frida_tools/') and p.name not in {
            'play_mp.sh','play_offline.sh','play_with_bots.sh','boot_offline.sh','run_host.sh',
            'menu.sh','menu_keeper.sh','match_from_menu.sh','unlock_all_menu.sh',
            'run_arm.sh','prepare_loadout_frontend.sh'}:
            return
        result=subprocess.run(['zsh','-n',str(p)],capture_output=True,text=True)
        if result.returncode:issues.append((rel,'Invalid zsh script syntax'))


def main():
    failures=[];stats=collections.Counter();sizes=collections.Counter()
    for p in source_files():
        rel=str(p.relative_to(ROOT))
        if p.is_symlink():failures.append((rel,'Symlink forbidden'));continue
        if p.suffix.lower() in BANNED_SUFFIXES:failures.append((rel,'Excluded game binary/data type'))
        data=p.read_bytes();stats[p.suffix.lower() or '<none>']+=1;sizes['bytes']+=len(data)
        try:s=data.decode('utf-8')
        except UnicodeDecodeError:
            failures.append((rel,'Non-UTF8 binary payload'))
            continue
        # Separate literals so running this scanner does not print/embed real
        # home folders, device addresses or personal identifiers itself.
        patterns={
            'Mac user-home path':re.compile('/'+'Users'+'/[^/\\s\\x22\\x27]+',re.I),
            'Windows user-home path':re.compile('[a-z]:\\\\'+'Users'+'\\\\[^\\\\\\s]+',re.I),
            'LAN address literal':re.compile(r'\b(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)\d{1,3}\.\d{1,3}\b'),
            'Email address':re.compile(r'\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b'),
            'Likely API token':re.compile(r'\b(?:sk-|ghp_|xoxb-)[A-Za-z0-9_-]{20,}\b'),
            'Forgotten scrub placeholder':re.compile('__'+'WZM_SOURCE_ROOT__'),
        }
        for kind,pattern in patterns.items():
            if pattern.search(s):failures.append((rel,kind))
        if p.name == 'device.sh' or rel.startswith('analysis/runtime/'):
            failures.append((rel,'Private runtime/device settings accidentally bundled'))
        check_syntax(p,data,failures)
    print(f'Privacy/source audit: {sum(stats.values())} UTF-8 files, {sizes["bytes"]} bytes')
    print('Source counts:',dict(stats.most_common(12)))
    if failures:
        print(f'FAIL: {len(failures)} findings (contents withheld)')
        for rel,kind in failures[:60]:print(' ',kind,'in',rel)
        return 1
    print('PASS: no listed personal-path, device address, email, token, game binary or syntax issues')
    return 0


if __name__=='__main__':sys.exit(main())
