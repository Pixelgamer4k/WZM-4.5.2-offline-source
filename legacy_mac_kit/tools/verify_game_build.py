#!/usr/bin/env python3
"""Offline SHA-256 verification of user-supplied original WZM game files.

Never reads a connected phone or modifies an input file.
"""
import argparse
import hashlib
import pathlib

EXPECTED={
    'base':'a8252312ecda283b845f4fbac36b97c1d5dea95957f8ea737c869fce181da553',
    'libgame':'c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7',
}

def checksum(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base',type=pathlib.Path,help='Your own original v4.5.2 base.apk')
    p.add_argument('--libgame',type=pathlib.Path,help='Your own extracted original libgame.so')
    args=p.parse_args()
    found=False
    for label in ('base','libgame'):
        path=getattr(args,label)
        if path is None:continue
        found=True
        result=checksum(path)
        if result!=EXPECTED[label]:
            print(label+': MISMATCH (not the pinned original game bytes); refusing compatibility claim')
            return 1
        print(label+': SHA-256 MATCH — original source version verified')
    if not found:p.error('Provide --base, --libgame, or both')
    print('Matching file hashes do not prove Android/root/Frida compatibility.')
    return 0

if __name__=='__main__':raise SystemExit(main())
