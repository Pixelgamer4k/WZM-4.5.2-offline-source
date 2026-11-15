#!/usr/bin/env python3
"""Build a same-signer startup comparison with the original GameApplication."""
import os
import tempfile
from pathlib import Path
from zipfile import ZipFile

from build import (
    APK_NAMES, BOOT, EXPECTED_SIGNER, HERE, PRIVATE, SOURCE, TOOLS,
    digest, members, run, safe_copy_zip, sign_one,
)

BASELINE = HERE / 'signed_five_split_r3_trace'
CONTROL = HERE / 'signed_five_split_r4_boot_control'


def main():
    if CONTROL.exists():
        raise FileExistsError(CONTROL)
    with ZipFile(SOURCE / 'base.apk') as original, ZipFile(BASELINE / 'base.apk') as baseline:
        dex = original.read('classes.dex')
        html = original.read(BOOT)
        if b'wzmLoadGadget' not in baseline.read('classes.dex') or b'wzmLoadGadget' in dex:
            raise ValueError('Expected original and modified loader versions')
        if baseline.read(BOOT) != html:
            raise ValueError('Baseline boot page differs from the archived offline page')

    env = dict(os.environ)
    env['WZM_OFFLINE_KEY_PASSWORD'] = (PRIVATE / 'PASSWORD_KEEP_PRIVATE.txt').read_text().strip()
    with tempfile.TemporaryDirectory(prefix='.boot-control-', dir=HERE) as directory:
        work = Path(directory)
        signed = work / 'signed'
        signed.mkdir()
        unsigned = work / 'base.unsigned.apk'
        apk = signed / 'base.apk'
        safe_copy_zip(BASELINE / 'base.apk', unsigned, replacements={'classes.dex': dex})
        sign_one(unsigned, apk, PRIVATE / 'wzm_offline_test_signing.p12', env)
        certs = run([TOOLS / 'apksigner', 'verify', '--print-certs', apk])
        if f'Signer #1 certificate SHA-256 digest: {EXPECTED_SIGNER}' not in certs:
            raise ValueError('Control APK signer differs')
        run([TOOLS / 'zipalign', '-c', '-p', '4', apk])
        before, after = members(BASELINE / 'base.apk'), members(apk)
        if {name for name in before.keys() | after.keys() if before.get(name) != after.get(name)} != {'classes.dex'}:
            raise ValueError('Control changed files outside the game DEX')
        with ZipFile(apk) as verified:
            if verified.read('classes.dex') != dex or verified.read(BOOT) != html:
                raise ValueError('Control DEX or offline HTML differs from its archived input')
        sums = dict((name, checksum) for checksum, name in
                    map(str.split, (BASELINE / 'SHA256SUMS.txt').read_text().splitlines()))
        sums['base.apk'] = digest(apk)
        for name in APK_NAMES[1:]:
            run(['cp', '-c', BASELINE / name, signed / name])
            if digest(signed / name) != sums[name]:
                raise ValueError(f'Control changed an inherited split: {name}')
        (signed / 'SHA256SUMS.txt').write_text(
            ''.join(f'{sums[name]}  {name}\n' for name in APK_NAMES))
        signed.rename(CONTROL)
    print(f'Verified comparison build: {CONTROL}', flush=True)


if __name__ == '__main__':
    main()
