#!/usr/bin/env python3
"""One-step build: original Warzone Mobile 4.5.2 splits -> signed offline five-split set.

Combines the proven historical steps (build.py, build_delayed.py, build_r7.py, build_base_offline_page.py):

  base.apk
    assets/bootstrap/index.html   <- offline_bootstrap.html (skips the dead online pre-login page)
    assets/bootstrap/offline.js   <- "you appear to be offline" box disabled
    classes.dex                   <- GameApplication.onCreate schedules a thread that waits 25 s, then
                                     System.loadLibrary("gadget") (main process only)
    AndroidManifest.xml           <- extractNativeLibs=true + one signature permission (axml_patch.py)
  split_config.arm64_v8a.apk
    lib/arm64-v8a/libgadget.so          <- official Frida Gadget 17.x arm64
    lib/arm64-v8a/libgadget.config.so   <- gadget_config/libgadget.config.json (script mode)
    lib/arm64-v8a/libgadget.script.so   <- agent/entry.js compiled by frida-compile
  other three splits: unchanged bytes, re-signed with the same key

usage:
  python3 build/build_all.py --original DIR_WITH_5_ORIGINAL_SPLITS --gadget frida-gadget.so \
      --keystore signing/wzm_offline_test_signing.p12 --output OUT_DIR
  (keystore password in env WZM_OFFLINE_KEY_PASSWORD; key alias 'wzm-offline-test')
Needs: apktool, Android build-tools (zipalign, apksigner) in ANDROID_BUILD_TOOLS, frida-compile on PATH.
"""
import argparse
import hashlib
import os
import sys
import shutil
import tempfile
from pathlib import Path
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_package import run, safe_copy_zip, sign_one  # noqa: E402
from axml_patch import patch_manifest  # noqa: E402

GADGET_METHOD = '''
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
'''
ON_CREATE_END = '''    invoke-static {p0}, Lcom/activision/game/DWGooglePlayIntegrityAsyncTask;->initialize(Landroid/content/Context;)V

    return-void
.end method'''
SCHEDULE = '''
.method private static wzmScheduleGadget()V
    .locals 2

    invoke-static {}, Landroid/app/Application;->getProcessName()Ljava/lang/String;
    move-result-object v0
    const-string v1, "com.activision.callofduty.warzone"
    invoke-virtual {v1, v0}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v0
    if-eqz v0, :done

    new-instance v0, Lcom/activision/game/WzmDeferredGadget;
    invoke-direct {v0}, Lcom/activision/game/WzmDeferredGadget;-><init>()V
    new-instance v1, Ljava/lang/Thread;
    invoke-direct {v1, v0}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V
    invoke-virtual {v1}, Ljava/lang/Thread;->start()V

    :done
    return-void
.end method
'''
RUNNABLE = '''
.class final Lcom/activision/game/WzmDeferredGadget;
.super Ljava/lang/Object;
.implements Ljava/lang/Runnable;

.method constructor <init>()V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    return-void
.end method

.method public run()V
    .locals 2

    :wait_start
    const-wide/16 v0, 0x61a8
    invoke-static {v0, v1}, Ljava/lang/Thread;->sleep(J)V
    :wait_end
    .catch Ljava/lang/InterruptedException; {:wait_start .. :wait_end} :interrupted

    const-string v0, "WZM_BOOT"
    const-string v1, "Loading deferred Gadget after 25s startup grace"
    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    invoke-static {}, Lcom/activision/game/GameApplication;->wzmLoadGadget()V
    return-void

    :interrupted
    move-exception v0
    return-void
.end method
'''

APK_NAMES = ('base.apk', 'split_config.arm64_v8a.apk', 'split_config.en.apk',
             'split_config.xxxhdpi.apk', 'split_asset_pack.apk')
BOOT = 'assets/bootstrap/index.html'
OFFLINE_JS = 'assets/bootstrap/offline.js'
LIBGAME_SHA256 = 'c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7'
OFFLINE_OLD = """const setOffline = () => {
  document.getElementById('offline').style.display = 'flex';"""
OFFLINE_NEW = """const setOffline = () => {
  // WZM offline: the game is played offline; never show the offline box.
  document.getElementById('offline').style.display = 'none'; return;"""


def build_dex(work, base_apk):
    decoded = work / 'decoded'
    run(['apktool', 'd', '-r', '-o', decoded, base_apk])
    package = decoded / 'smali/com/activision/game'
    application = package / 'GameApplication.smali'
    original = application.read_text()
    if original.count(ON_CREATE_END) != 1 or 'wzmLoadGadget' in original:
        raise SystemExit('GameApplication.onCreate does not match 4.5.2 (or is already patched)')
    revised = ON_CREATE_END.replace(
        '    return-void',
        '    invoke-static {}, Lcom/activision/game/GameApplication;->wzmScheduleGadget()V\n\n    return-void')
    application.write_text(original.replace(ON_CREATE_END, revised) + SCHEDULE +
                           GADGET_METHOD.replace('private static', 'static', 1))
    (package / 'WzmDeferredGadget.smali').write_text(RUNNABLE)
    rebuilt = work / 'dex.apk'
    run(['apktool', 'b', '-o', rebuilt, decoded])
    with ZipFile(rebuilt) as apk:
        return apk.read('classes.dex')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--original', type=Path, required=True, help='folder with the 5 original 4.5.2 split APKs')
    ap.add_argument('--gadget', type=Path, required=True, help='Frida Gadget 17.x android-arm64 .so (unpacked)')
    ap.add_argument('--keystore', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--keep-offline-box', action='store_true', help='do not patch offline.js')
    a = ap.parse_args()
    if a.output.exists():
        raise SystemExit(f'{a.output} exists; refusing to overwrite')
    if not os.environ.get('WZM_OFFLINE_KEY_PASSWORD'):
        raise SystemExit('set WZM_OFFLINE_KEY_PASSWORD to your keystore password')
    src = a.original.resolve()
    for n in APK_NAMES:
        if not (src / n).is_file():
            raise SystemExit(f'missing {src / n}')
    with ZipFile(src / APK_NAMES[1]) as abi, abi.open('lib/arm64-v8a/libgame.so') as g:
        if hashlib.file_digest(g, 'sha256').hexdigest() != LIBGAME_SHA256:
            print('WARNING: libgame.so is not the 4.5.2 build these addresses were made for; the agent WILL NOT work.')
    env = dict(os.environ)
    with tempfile.TemporaryDirectory(prefix='.build-all-', dir=HERE) as t:
        work = Path(t)
        signed = work / 'signed'
        signed.mkdir()
        script = work / 'libgadget.script.so'
        run(['frida-compile', HERE.parent / 'agent' / 'entry.js', '-o', script])
        with ZipFile(src / 'base.apk') as base:
            manifest = patch_manifest(base.read('AndroidManifest.xml'))
            offline_js = base.read(OFFLINE_JS).decode()
        base_repl = {
            BOOT: (HERE / 'offline_bootstrap.html').read_bytes(),
            'classes.dex': build_dex(work, src / 'base.apk'),
            'AndroidManifest.xml': manifest,
        }
        if not a.keep_offline_box:
            if OFFLINE_OLD not in offline_js:
                raise SystemExit('offline.js layout differs; rerun with --keep-offline-box')
            base_repl[OFFLINE_JS] = offline_js.replace(OFFLINE_OLD, OFFLINE_NEW, 1).encode()
        abi_add = {
            'lib/arm64-v8a/libgadget.so': a.gadget.read_bytes(),
            'lib/arm64-v8a/libgadget.config.so': (HERE / 'gadget_config' / 'libgadget.config.json').read_bytes(),
            'lib/arm64-v8a/libgadget.script.so': script.read_bytes(),
        }
        for n in APK_NAMES:
            print('building', n, flush=True)
            unsigned = work / ('unsigned-' + n)
            if n == 'base.apk':
                safe_copy_zip(src / n, unsigned, replacements=base_repl)
            elif n == 'split_config.arm64_v8a.apk':
                safe_copy_zip(src / n, unsigned, additions=abi_add)
            else:
                shutil.copyfile(src / n, unsigned)
            sign_one(unsigned, signed / n, a.keystore, env)
            unsigned.unlink()
        sums = ''.join(f'{hashlib.sha256((signed / n).read_bytes()).hexdigest()}  {n}\n' for n in APK_NAMES)
        (signed / 'SHA256SUMS.txt').write_text(sums)
        a.output.parent.mkdir(parents=True, exist_ok=True)
        signed.rename(a.output)
    print('done:', a.output)


if __name__ == '__main__':
    main()
