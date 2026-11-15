#!/usr/bin/env python3
"""Build a local, separately signed five-split WZM 4.5.2 Gadget research build.

Preserves original owner-provided APKs. Never calls adb or installs anything.
The floating companion and in-process Frida bridge are only a static prototype;
gameplay-host and native anti-tamper compatibility are not implemented.
"""
import argparse
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

from axml_patch import patch_manifest

HERE = Path(__file__).resolve().parent
POC = HERE.parent
TOOLS = Path(os.environ.get('ANDROID_BUILD_TOOLS', Path.home() / 'Library/Android/sdk/build-tools/35.0.0'))
APK_NAMES = ('base.apk', 'split_config.arm64_v8a.apk', 'split_config.en.apk',
             'split_config.xxxhdpi.apk', 'split_asset_pack.apk')
PKG = 'com.activision.callofduty.warzone'
BOOT = 'assets/bootstrap/index.html'
GADGET = {
    'lib/arm64-v8a/libgadget.so': Path('../WarzoneMobileOffline/analysis/no_root_build/gadget/libgadget.so'),
    'lib/arm64-v8a/libgadget.config.so': POC / 'game-agent/libgadget.config.json',
    'lib/arm64-v8a/libgadget.script.so': POC / 'game-agent/libgadget.script.so',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def run(argv, *, env=None):
    p = subprocess.run([str(x) for x in argv], stdout=subprocess.PIPE,
                       stderr=subprocess.STDOUT, text=True, env=env)
    if p.returncode:
        raise RuntimeError(f'{Path(argv[0]).name} failed with {p.returncode}: {p.stdout[-1800:]}')
    return p.stdout


def safe_copy_zip(source, dest, replacements=None, additions=None):
    replacements = replacements or {}
    additions = additions or {}
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(dest, 'w', allowZip64=True) as dst:
        existing = set()
        for info in src.infolist():
            name = info.filename
            if name in existing:raise ValueError(f'Duplicate file in source: {name}')
            existing.add(name)
            if name.startswith('META-INF/') and name.endswith(('.SF','.RSA','.DSA','.EC')):
                continue
            if name == 'META-INF/MANIFEST.MF':continue
            if name in additions:raise ValueError(f'Expected new file already exists: {name}')
            raw = replacements.get(name)
            if raw is None: raw = src.read(name)
            # Keep native DEX compression flags; compressed Gadget payloads are extracted.
            dst.writestr(info, raw)
        missing = set(replacements) - existing
        if missing:raise ValueError(f'Expected replacement absent in source: {missing}')
        for name, data in additions.items():
            dst.writestr(name, data, compress_type=zipfile.ZIP_DEFLATED)


def validate_base(source, trusted_base, loader_base):
    with zipfile.ZipFile(source) as s, zipfile.ZipFile(trusted_base) as old, zipfile.ZipFile(loader_base) as loader:
        boot = s.read(BOOT)
        assert all(x in boot for x in (b'passPreloginFence',b'closeWebView',b'sysReady')), 'Missing installed-phone offline bootstrap'
        selected_dex = s.read('classes.dex')
        baseline = old.read('classes.dex')
        if selected_dex == baseline:
            selected_dex = loader.read('classes.dex')
            assert all(x in selected_dex for x in (b'com/wzm/Loader',b'gadget')), 'Trusted Gadget loader DEX missing'
            loaded_from = 'trusted prior Gadget-loader base; original DEX precondition matched'
        else:
            assert all(x in selected_dex for x in (b'com/wzm/Loader',b'gadget')), 'Unknown modified DEX; refuse to overwrite unknown phone fixes'
            loaded_from = 'selected input already contains Gadget loader'
        source_manifest = s.read('AndroidManifest.xml')
        merged_manifest = patch_manifest(source_manifest)
        return ({'classes.dex': selected_dex, 'AndroidManifest.xml': merged_manifest},
                {'offline_bootstrap_sha256': sha(boot), 'dex_source': loaded_from,
                 'selected_dex_sha256': sha(selected_dex), 'manifest_sha256': sha(merged_manifest)})


def sign_one(inp, output, ks, env):
    aligned = inp.with_suffix('.aligned.tmp.apk')
    run([TOOLS / 'zipalign', '-p', '-f', '4', inp, aligned])
    # Standalone split verification assumes minSdk=1 when uses-sdk is absent;
    # include v1 so it verifies independently, in addition to Android 13+ v2/v3.
    run([TOOLS / 'apksigner', 'sign', '--ks', ks, '--ks-key-alias', 'wzm-offline-test',
         '--ks-pass', 'env:WZM_OFFLINE_KEY_PASSWORD', '--key-pass', 'env:WZM_OFFLINE_KEY_PASSWORD',
         '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true',
         '--v3-signing-enabled', 'true', '--v4-signing-enabled', 'false',
         '--out', output, aligned], env=env)
    aligned.unlink()


def verify(out_dir, base_evidence, split_source):
    checks = []
    def expect(label, condition, info=''):
        checks.append({'check':label,'pass':bool(condition),'detail':info})
        if not condition:raise ValueError(f'FAILED: {label}: {info}')
    certs = []
    for name in APK_NAMES + ('overlay-controller.apk',):
        apk = out_dir/name
        txt = run([TOOLS/'apksigner','verify','--print-certs',apk])
        cert = re.search(r'Signer #1 certificate SHA-256 digest: ([0-9a-f]+)',txt)
        expect(f'signature {name}',bool(cert))
        certs.append(cert.group(1))
    expect('all six APKs share signer',len(set(certs)) == 1)
    with zipfile.ZipFile(out_dir/'base.apk') as b, zipfile.ZipFile(split_source/'base.apk') as original:
        expect('offline bootstrap preserved',sha(b.read(BOOT)) == base_evidence['offline_bootstrap_sha256'])
        expect('Gadget loader DEX',all(x in b.read('classes.dex') for x in (b'com/wzm/Loader',b'gadget')))
        expect('game resource table not rebuilt',
               b.read('resources.arsc') == original.read('resources.arsc'))
    with zipfile.ZipFile(out_dir/'split_config.arm64_v8a.apk') as b:
        for name, path in GADGET.items():
            expected_path=path if path.is_absolute() else POC/path
            expect('current embedded '+name,sha(b.read(name)) == sha(expected_path.read_bytes()))
        expect('autonomous script without debug socket',json.loads(b.read('lib/arm64-v8a/libgadget.config.so'))['interaction']['type'] == 'script')
    manifest = run([TOOLS/'aapt','dump','xmltree',out_dir/'base.apk','AndroidManifest.xml'])
    expect('signature permission declared in game','com.wzm.offline.permission.CONTROL' in manifest and 'protectionLevel' in manifest)
    expect('native libraries extractable',bool(re.search(r'extractNativeLibs.*=\(type 0x12\)0xffffffff',manifest)))
    info = run([TOOLS/'aapt','dump','badging',out_dir/'base.apk'])
    expect('game version intact',"versionName='4.5.2.22729281'" in info and f"name='{PKG}'" in info)
    for name in ('split_config.en.apk','split_config.xxxhdpi.apk','split_asset_pack.apk'):
        with zipfile.ZipFile(split_source/name) as src, zipfile.ZipFile(out_dir/name) as built:
            # apksigner removes the obsolete upstream stamp-cert-sha256: source
            # stamps identify the *old* package signer and cannot be retained.
            def payload(info):
                return not info.filename.startswith('META-INF/') and info.filename != 'stamp-cert-sha256'
            sc={i.filename:(i.CRC,i.file_size) for i in src.infolist() if payload(i)}
            bc={i.filename:(i.CRC,i.file_size) for i in built.infolist() if payload(i)}
            expect(f'{name} ZIP payload unchanged excluding invalidated source stamp',sc == bc)
    receipt = {'scope':'static, not device/boot/gameplay verified',
               'signer_sha256':certs[0], 'base':base_evidence,
               'checks':checks, 'passed':len(checks), 'failed':0}
    (out_dir/'verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('STATIC VERIFIED:',len(checks),'checks; common signer',certs[0][:16])


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input',type=Path,required=True,help='exact backed-up installed phone splits; read-only')
    ap.add_argument('--trusted-original',type=Path,required=True,help='independent owner-held original splits; read-only')
    ap.add_argument('--trusted-gadget-base',type=Path,required=True,help='previous local loader DEX source; read-only')
    ap.add_argument('--out-dir',type=Path,default=HERE/'built_five_split',help='new isolated folder; must not exist')
    args=ap.parse_args()
    src=args.input.resolve(); orig=args.trusted_original.resolve(); old=args.trusted_gadget_base.resolve()
    output=args.out_dir.resolve()
    if not all((src/x).is_file() for x in APK_NAMES):raise ValueError('Required input APK missing')
    if output.exists():raise ValueError('Output exists; refuse overwrite')
    if not output.is_relative_to(HERE):raise ValueError('Output must stay under dedicated isolated worker folder')
    for tool in ('aapt','zipalign','apksigner'):
        if not (TOOLS/tool).is_file():raise FileNotFoundError(tool)
    if not (POC/'overlay-app/build/outputs/apk/debug/overlay-app-debug.apk').is_file():
        raise ValueError('Compile standalone floating controller before signing')
    replacements,evidence=validate_base(src/'base.apk',orig/'base.apk',old)
    gadget_bytes={name: (POC / path).read_bytes() if not path.is_absolute() else path.read_bytes()
                  for name,path in GADGET.items()}
    assert gadget_bytes['lib/arm64-v8a/libgadget.so'][:4]==b'\x7fELF'
    assert len(gadget_bytes['lib/arm64-v8a/libgadget.script.so'])>200000
    output.mkdir(parents=True)
    scratch=output/'work';scratch.mkdir()
    print('Preparing offline patched base (installed source bootstrap preserved)')
    safe_copy_zip(src/'base.apk',scratch/'base.unsigned.apk',replacements)
    print('Preparing ABI split with local native Gadget and current Frida 17 compiled bridge')
    safe_copy_zip(src/'split_config.arm64_v8a.apk',scratch/'arm64.unsigned.apk',additions=gadget_bytes)
    for name in APK_NAMES[2:]:
        shutil.copy2(src/name,scratch/name)
    shutil.copy2(POC/'overlay-app/build/outputs/apk/debug/overlay-app-debug.apk',scratch/'overlay.unsigned.apk')
    private=HERE/'private_signing_secret';private.mkdir(mode=0o700, exist_ok=True)
    secretfile=private/'PASSWORD_KEEP_PRIVATE.txt'
    key=private/'wzm_offline_test_signing.p12'
    if key.exists() and secretfile.exists():
        # Stable signer required to install future updates to this locally signed build.
        password=secretfile.read_text().strip()
        if not password:raise ValueError('Empty signer password')
        print('Reusing existing local signing key for update compatibility')
    elif not key.exists() and not secretfile.exists():
        password=secrets.token_urlsafe(36)
        secretfile.write_text(password+'\n');secretfile.chmod(0o600)
    else:
        raise ValueError('Incomplete private keystore/password; refuse to rotate signing identity')
    env=os.environ.copy();env['WZM_OFFLINE_KEY_PASSWORD']=password
    if not key.exists():
        run(['keytool','-genkeypair','-alias','wzm-offline-test','-keyalg','RSA',
             '-keysize','3072','-validity','3650','-dname','CN=Private WZM Test, O=Local Research',
             '-keystore',key,'-storetype','PKCS12',
             '-storepass:env','WZM_OFFLINE_KEY_PASSWORD','-keypass:env','WZM_OFFLINE_KEY_PASSWORD',
             '-noprompt'],env=env)
    key.chmod(0o600)
    jobs=[('base.apk','base.unsigned.apk'),('split_config.arm64_v8a.apk','arm64.unsigned.apk'),
          ('split_config.en.apk','split_config.en.apk'),
          ('split_config.xxxhdpi.apk','split_config.xxxhdpi.apk'),
          ('split_asset_pack.apk','split_asset_pack.apk'),
          ('overlay-controller.apk','overlay.unsigned.apk')]
    for name,inp in jobs:
        print('Aligning/signing:',name,flush=True)
        sign_one(scratch/inp,output/name,key,env)
        (scratch/inp).unlink()
    verify(output,evidence,src)
    scratch.rmdir()
    print('Output:',output,'; private signing key MUST be retained for future updates',flush=True)


if __name__=='__main__':
    try: main()
    except Exception as exc:
        print('FAILED (see partial output folder; never install):',str(exc),file=sys.stderr)
        sys.exit(1)
