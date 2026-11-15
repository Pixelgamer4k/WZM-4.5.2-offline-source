#!/usr/bin/env python3
"""Rebuild the five APK splits from the archived working offline base."""
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent                      # package root (folder that holds agent/, build/, bridge/)
# Inputs you provide (see docs/02_BUILD_THE_APK.md):
#   SOURCE  = your phone's installed 4.5.2 splits, with base.apk already carrying the offline start page
#   STOCK   = the untouched original 4.5.2 splits (used only to prove classes.dex is unmodified)
#   PRIVATE = your own signing key folder (wzm_offline_test_signing.p12 + PASSWORD_KEEP_PRIVATE.txt)
SOURCE = Path(os.environ.get('WZM_SOURCE_SPLITS', PROJECT / 'input' / 'working_splits'))
STOCK = Path(os.environ.get('WZM_STOCK_SPLITS', PROJECT / 'input' / 'original_splits'))
AGENT = PROJECT / 'agent'
PRIVATE = Path(os.environ.get('WZM_SIGNING_DIR', PROJECT / 'signing'))
GADGET_SO = Path(os.environ.get('WZM_GADGET_SO', HERE / 'gadget' / 'libgadget.so'))
GADGET_CONFIG = HERE / 'gadget_config' / 'libgadget.config.json'
OUTPUT = HERE / 'signed_five_split'
LOADER = '    invoke-static {}, Lcom/activision/game/GameApplication;->wzmLoadGadget()V\n\n'
GADGET_METHOD = """
.method private static wzmLoadGadget()V
    .locals 3

    :gadget_start
    const-string v0, "gadget"
    invoke-static {v0}, Ljava/lang/System;->loadLibrary(Ljava/lang/String;)V
    :gadget_end
    .catch Ljava/lang/UnsatisfiedLinkError; {:gadget_start .. :gadget_end} :gadget_error
    return-void

    :gadget_error
    move-exception v0
    const-string v1, "WZM_BOOT"
    const-string v2, "Could not load embedded Gadget"
    invoke-static {v1, v2, v0}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I
    return-void
.end method
"""
# SHA-256 of the working base.apk used originally; set WZM_SKIP_BASE_CHECK=1 for a different copy.
EXPECTED_BASE = '1a2065b43623364895892b73b5d0be7d42ad345f7742f6aed83fcd164994f6e9'
# SHA-256 of YOUR signing certificate (apksigner verify --print-certs). Empty = do not pin.
EXPECTED_SIGNER = os.environ.get('WZM_SIGNER_SHA256', '')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def dex_from_source(scratch):
    decoded = scratch / 'decoded'
    run(['apktool', 'd', '-r', '-o', decoded, SOURCE / 'base.apk'])
    smali = decoded / 'smali/com/activision/game/GameApplication.smali'
    source = smali.read_text()
    anchor = '.method static constructor <clinit>()V\n    .locals 1\n\n'
    if source.count(anchor) != 1 or 'wzmLoadGadget' in source or '"vmpc"' not in source:
        raise ValueError('GameApplication initializer differs from the archived original')
    smali.write_text(source.replace(anchor, anchor + LOADER, 1) + GADGET_METHOD)
    rebuilt = scratch / 'dex-only.apk'
    run(['apktool', 'b', '-o', rebuilt, decoded])
    with ZipFile(rebuilt) as zip_file:
        return zip_file.read('classes.dex')


def members(path):
    with ZipFile(path) as apk:
        return {
            entry.filename: (entry.file_size, entry.CRC)
            for entry in apk.infolist()
            if not entry.filename.startswith('META-INF/')
            and entry.filename != 'stamp-cert-sha256'
        }


def verify(output, replacements, additions):
    expected_changes = {'base.apk': set(replacements), APK_NAMES[1]: set(additions)}
    for name in APK_NAMES:
        apk = output / name
        report = run([TOOLS / 'apksigner', 'verify', '--print-certs', apk])
        signers = re.findall(r'Signer #\d+ certificate SHA-256 digest: ([a-f0-9]+)', report)
        if EXPECTED_SIGNER and signers != [EXPECTED_SIGNER]:
            raise ValueError(f'Signing certificate changed for {name}')
        run([TOOLS / 'zipalign', '-c', '-p', '4', apk])
        before, after = members(SOURCE / name), members(apk)
        changed = {key for key in before.keys() | after.keys() if before.get(key) != after.get(key)}
        if changed != expected_changes.get(name, set()):
            raise ValueError(f'Unexpected package changes in {name}: {sorted(changed)}')
    with ZipFile(output / 'base.apk') as base, ZipFile(SOURCE / 'base.apk') as source:
        if base.read(BOOT) != source.read(BOOT):
            raise ValueError('Working offline startup HTML changed')
        if any(base.read(key) != value for key, value in replacements.items()):
            raise ValueError('Signed base contains unexpected manifest or bytecode')
    with ZipFile(output / APK_NAMES[1]) as abi:
        if any(abi.read(key) != value for key, value in additions.items()):
            raise ValueError('Gadget or its local script was not embedded intact')
        with abi.open('lib/arm64-v8a/libgame.so') as game:
            if hashlib.file_digest(game, 'sha256').hexdigest() != 'c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7':
                raise ValueError('Original game engine checksum changed')
    badging = run([TOOLS / 'aapt', 'dump', 'badging', output / 'base.apk'])
    if f"name='{PKG}' versionCode='3953' versionName='4.5.2.22729281'" not in badging:
        raise ValueError('Game package or version changed')


def main():
    if OUTPUT.exists():
        raise FileExistsError(f'Refusing to overwrite {OUTPUT}')
    if not os.environ.get('WZM_SKIP_BASE_CHECK') and digest(SOURCE / 'base.apk') != EXPECTED_BASE:
        raise ValueError('Archived working base checksum changed')
    with ZipFile(SOURCE / 'base.apk') as base, ZipFile(STOCK / 'base.apk') as stock:
        html = base.read(BOOT)
        if base.read('classes.dex') != stock.read('classes.dex'):
            raise ValueError('Working base DEX differs from the original')
        if not all(marker in html for marker in (b'sysReady', b'passPreloginFence', b'closeWebView')):
            raise ValueError('Expected offline bootstrap is missing')
        manifest = patch_manifest(base.read('AndroidManifest.xml'))

    env = dict(os.environ)
    env['WZM_OFFLINE_KEY_PASSWORD'] = (PRIVATE / 'PASSWORD_KEEP_PRIVATE.txt').read_text().strip()
    key = PRIVATE / 'wzm_offline_test_signing.p12'
    with tempfile.TemporaryDirectory(prefix='.build-', dir=HERE) as directory:
        scratch = Path(directory)
        output = scratch / 'signed'
        output.mkdir()
        compiled = scratch / 'libgadget.script.so'
        run(['frida-compile', AGENT / 'entry.js', '-o', compiled])
        gadget = GADGET_SO
        libraries = {
            'libgadget.so': gadget.read_bytes(),
            'libgadget.config.so': GADGET_CONFIG.read_bytes(),
            'libgadget.script.so': compiled.read_bytes(),
        }
        if json.loads(libraries['libgadget.config.so'])['interaction'] != {
            'type': 'script', 'path': 'libgadget.script.so', 'on_change': 'ignore'
        }:
            raise ValueError('Gadget must start its embedded script without a listener')
        additions = {f'lib/arm64-v8a/{name}': data for name, data in libraries.items()}
        replacements = {'classes.dex': dex_from_source(scratch), 'AndroidManifest.xml': manifest}
        for name in APK_NAMES:
            print(f'Building {name}', flush=True)
            source = SOURCE / name
            if name in APK_NAMES[:2]:
                source = scratch / f'unsigned-{name}'
                if name == 'base.apk':
                    safe_copy_zip(SOURCE / name, source, replacements=replacements)
                else:
                    safe_copy_zip(SOURCE / name, source, additions=additions)
            # Alignment produces a temporary file beside the input.
            else:
                source = scratch / name
                run(['cp', '-c', SOURCE / name, source])
            sign_one(source, output / name, key, env)
            source.unlink()
        print('Verifying signatures, alignment and payloads', flush=True)
        verify(output, replacements, additions)
        (output / 'SHA256SUMS.txt').write_text(
            ''.join(f'{digest(output / name)}  {name}\n' for name in APK_NAMES))
        (output / 'build_receipt.json').write_text(json.dumps({
            'source_base_sha256': EXPECTED_BASE,
            'offline_html_sha256': hashlib.sha256(html).hexdigest(),
            'signer_sha256': EXPECTED_SIGNER,
            'gadget_script_sha256': digest(compiled),
            'runtime_verified': False,
        }, indent=2) + '\n')
        output.rename(OUTPUT)
    print(f'Statically verified five splits at {OUTPUT}', flush=True)


if __name__ == '__main__':
    main()
