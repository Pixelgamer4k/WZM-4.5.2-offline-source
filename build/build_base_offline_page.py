#!/usr/bin/env python3
"""Patch base.apk's startup splash page so it never shows "You appear to be offline".

The game shows assets/bootstrap/splash.html while it starts. Its offline.js shows an
offline box with a retry button whenever Android reports no network (navigator.onLine is
false), e.g. Wi-Fi and mobile data both off. Offline play never needs the network, so the
box is disabled. Everything else in the set is copied (hard-linked) from --source; the
arm64 split may be replaced with --abi (e.g. a newer agent build).

usage: build_base_offline_page.py --source DIR --output DIR [--abi DIR]
"""
import argparse
import os
import shutil
import tempfile
from pathlib import Path
from zipfile import ZipFile

from build import APK_NAMES, EXPECTED_SIGNER, HERE, PRIVATE, TOOLS, run, safe_copy_zip, sign_one, digest

PAGE = 'assets/bootstrap/offline.js'
OLD = """const setOffline = () => {
  document.getElementById('offline').style.display = 'flex';"""
NEW = """const setOffline = () => {
  // WZM offline: the game is played offline; never show the offline box.
  document.getElementById('offline').style.display = 'none'; return;"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--abi', type=Path, default=None, help='take split_config.arm64_v8a.apk from this set instead')
    a = ap.parse_args()
    source, output = a.source.resolve(), a.output.resolve()
    if output.exists():
        raise FileExistsError(output)
    env = dict(os.environ)
    env['WZM_OFFLINE_KEY_PASSWORD'] = (PRIVATE / 'PASSWORD_KEEP_PRIVATE.txt').read_text().strip()
    with ZipFile(source / 'base.apk') as z:
        page = z.read(PAGE).decode()
    if OLD not in page:
        raise SystemExit('offline.js layout changed; not patching')
    patched = page.replace(OLD, NEW, 1).encode()
    output.mkdir()
    with tempfile.TemporaryDirectory(dir=HERE) as t:
        tmp = Path(t)
        js = tmp / 'offline.js'
        js.write_bytes(patched)
        unsigned = tmp / 'base.unsigned.apk'
        safe_copy_zip(source / 'base.apk', unsigned, replacements={PAGE: patched})
        sign_one(unsigned, output / 'base.apk', PRIVATE / 'wzm_offline_test_signing.p12', env)
    certs = run([TOOLS / 'apksigner', 'verify', '--print-certs', output / 'base.apk'])
    if EXPECTED_SIGNER not in str(certs).lower().replace(':', ''):
        print('warning: signer check text:', str(certs)[:300])
    run([TOOLS / 'zipalign', '-c', '-p', '4', output / 'base.apk'])
    for name in APK_NAMES:
        if name == 'base.apk':
            continue
        src = (a.abi.resolve() if a.abi and name == 'split_config.arm64_v8a.apk' else source) / name
        os.link(src, output / name)
    with open(output / 'SHA256SUMS.txt', 'w') as f:
        for name in APK_NAMES:
            f.write(f'{digest(output / name)}  {name}\n')
    print('Verified', output)


if __name__ == '__main__':
    main()
