#!/usr/bin/env python3
"""Build the offline bootstrap from a user's OWN WZM 4.5.2 original base.apk.

Source-only distribution: no proprietary APK is packaged. The resulting APK is
UNSIGNED/NOT INSTALLABLE as a normal APK, and is intended only for a rooted,
REVERSIBLE runtime bind mount over an already-installed authentic game package.
"""
import argparse
import hashlib
import pathlib
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
EXPECTED_ORIGINAL_SHA256 = 'a8252312ecda283b845f4fbac36b97c1d5dea95957f8ea737c869fce181da553'
EXPECTED_PATCHED_SHA256 = '1a2065b43623364895892b73b5d0be7d42ad345f7742f6aed83fcd164994f6e9'
TARGET = 'assets/bootstrap/index.html'

def sha256(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',required=True,type=pathlib.Path,help='Locally owned original WZM 4.5.2 base.apk')
    p.add_argument('--output',type=pathlib.Path,default=pathlib.Path.home()/'.local/share/wzm452/base_offline_boot.apk')
    p.add_argument('--check-only',action='store_true')
    args=p.parse_args()
    digest=sha256(args.input)
    if digest!=EXPECTED_ORIGINAL_SHA256:
        raise SystemExit('Refusing wrong APK version/source: original SHA-256 mismatch. No output created. Got '+digest)
    page=(HERE/'offline_bootstrap.html').read_bytes()
    assert b'passPreloginFence' in page and b'closeWebView' in page
    with zipfile.ZipFile(args.input) as zin:
        orig=zin.read(TARGET)
        if b'build-selector-103.js' not in orig:
            raise SystemExit('Expected original bootstrap entry not present; refusing.')
        if args.check_only:
            print('Original APK matches pinned version and bootstrap marker; no output created.')
            return
        args.output.parent.mkdir(parents=True,exist_ok=True)
        if args.output.resolve()==args.input.resolve():
            raise SystemExit('Output must not overwrite input APK.')
        if args.output.exists():
            raise SystemExit('Output already exists; refusing overwrite: '+str(args.output))
        try:
            with zipfile.ZipFile(args.output,'w') as zout:
                for item in zin.infolist():
                    content=page if item.filename==TARGET else zin.read(item.filename)
                    zout.writestr(item,content)
            with zipfile.ZipFile(args.output) as check:
                assert check.testzip() is None
                assert check.read(TARGET)==page
            patched_hash=sha256(args.output)
            if patched_hash != EXPECTED_PATCHED_SHA256:
                raise ValueError('Patched output SHA mismatch, refusing incompatible artifact: '+patched_hash)
            print('Private patched APK generated:',args.output)
            print('SHA256:',patched_hash)
            print('Root-only, runtime bind mount ONLY; do not install or distribute APK.')
        except Exception:
            args.output.unlink(missing_ok=True)
            raise

if __name__=='__main__':main()
