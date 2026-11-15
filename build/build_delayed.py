#!/usr/bin/env python3
"""Package the offline agent with a delayed, main-process Gadget load."""
import os
import tempfile
from pathlib import Path
from zipfile import ZipFile

from build import (
    AGENT, APK_NAMES, BOOT, EXPECTED_SIGNER, GADGET_METHOD, HERE, PRIVATE,
    SOURCE, TOOLS, digest, members, run, safe_copy_zip, sign_one,
)

BASELINE = HERE / 'signed_five_split_r4_boot_control'
OUTPUT = HERE / 'signed_five_split_r5_delayed'
ABI = APK_NAMES[1]
SCRIPT = 'lib/arm64-v8a/libgadget.script.so'
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


def build_dex(work):
    decoded = work / 'decoded'
    run(['apktool', 'd', '-r', '-o', decoded, SOURCE / 'base.apk'])
    package = decoded / 'smali/com/activision/game'
    application = package / 'GameApplication.smali'
    original = application.read_text()
    if original.count(ON_CREATE_END) != 1 or 'wzmLoadGadget' in original:
        raise ValueError('Original startup method does not match the archive')
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
    if OUTPUT.exists():
        raise FileExistsError(OUTPUT)
    env = dict(os.environ)
    env['WZM_OFFLINE_KEY_PASSWORD'] = (PRIVATE / 'PASSWORD_KEEP_PRIVATE.txt').read_text().strip()
    key = PRIVATE / 'wzm_offline_test_signing.p12'
    with tempfile.TemporaryDirectory(prefix='.delayed-', dir=HERE) as scratch:
        work = Path(scratch)
        signed = work / 'signed'
        signed.mkdir()
        compiled = work / 'gadget.script.so'
        run(['frida-compile', AGENT / 'entry.js', '-o', compiled])
        replacements = {
            'base.apk': {'classes.dex': build_dex(work)},
            ABI: {SCRIPT: compiled.read_bytes()}
        }
        sums = dict((name, checksum) for checksum, name in
                    map(str.split, (BASELINE / 'SHA256SUMS.txt').read_text().splitlines()))
        for name in APK_NAMES:
            source = BASELINE / name
            target = signed / name
            if name not in replacements:
                run(['cp', '-c', source, target])
                if digest(target) != sums[name]:
                    raise ValueError(f'Unexpected change to {name}')
                continue
            unsigned = work / ('unsigned-' + name)
            payload = replacements[name]
            safe_copy_zip(source, unsigned, replacements=payload)
            sign_one(unsigned, target, key, env)
            certs = run([TOOLS / 'apksigner', 'verify', '--print-certs', target])
            if f'Signer #1 certificate SHA-256 digest: {EXPECTED_SIGNER}' not in certs:
                raise ValueError(f'Wrong signer for {name}')
            run([TOOLS / 'zipalign', '-c', '-p', '4', target])
            before, after = members(source), members(target)
            if {n for n in before.keys() | after.keys() if before.get(n) != after.get(n)} != set(payload):
                raise ValueError(f'Unexpected changed members in {name}')
            with ZipFile(target) as apk:
                if any(apk.read(n) != value for n, value in payload.items()):
                    raise ValueError(f'Wrong contents in {name}')
                if name == 'base.apk':
                    with ZipFile(SOURCE / name) as original:
                        if apk.read(BOOT) != original.read(BOOT):
                            raise ValueError('Offline startup page changed')
            sums[name] = digest(target)
        (signed / 'SHA256SUMS.txt').write_text(
            ''.join(f'{sums[name]}  {name}\n' for name in APK_NAMES))
        signed.rename(OUTPUT)
    print(f'Verified delayed-load split set: {OUTPUT}', flush=True)


if __name__ == '__main__':
    main()
