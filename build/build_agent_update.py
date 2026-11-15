#!/usr/bin/env python3
"""Build a complete five-split release with only the embedded agent changed."""
import argparse
import json
import os
import tempfile
from pathlib import Path
from zipfile import ZipFile

from build import (
    AGENT, APK_NAMES, EXPECTED_SIGNER, HERE, OUTPUT, PRIVATE, TOOLS,
    digest, members, run, safe_copy_zip, sign_one,
)

ABI = APK_NAMES[1]
SCRIPT = 'lib/arm64-v8a/libgadget.script.so'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=OUTPUT)
    parser.add_argument('--output', type=Path, default=HERE / 'signed_five_split_r2')
    args = parser.parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    if output.exists():
        raise FileExistsError(output)
    if output.parent != HERE:
        raise ValueError('Output must be an isolated directory beside the builder')
    env = dict(os.environ)
    env['WZM_OFFLINE_KEY_PASSWORD'] = (PRIVATE / 'PASSWORD_KEEP_PRIVATE.txt').read_text().strip()
    with tempfile.TemporaryDirectory(prefix='.agent-update-', dir=HERE) as directory:
        temp = Path(directory)
        signed = temp / 'signed'
        signed.mkdir()
        compiled = temp / 'agent.so'
        run(['frida-compile', AGENT / 'entry.js', '-o', compiled])
        script = compiled.read_bytes()
        unsigned = temp / 'arm64.unsigned.apk'
        safe_copy_zip(source / ABI, unsigned, replacements={SCRIPT: script})
        new_abi = signed / ABI
        sign_one(unsigned, new_abi, PRIVATE / 'wzm_offline_test_signing.p12', env)
        certs = run([TOOLS / 'apksigner', 'verify', '--print-certs', new_abi])
        if f'Signer #1 certificate SHA-256 digest: {EXPECTED_SIGNER}' not in certs:
            raise ValueError('Unexpected signing certificate')
        run([TOOLS / 'zipalign', '-c', '-p', '4', new_abi])
        old, new = members(source / ABI), members(new_abi)
        if {name for name in old.keys() | new.keys() if old.get(name) != new.get(name)} != {SCRIPT}:
            raise ValueError('Unexpected changes outside the embedded script')
        with ZipFile(new_abi) as apk:
            if apk.read(SCRIPT) != script:
                raise ValueError('Signed split does not contain the current agent')
        sums = dict((name, checksum) for checksum, name in
                    map(str.split, (source / 'SHA256SUMS.txt').read_text().splitlines()))
        for name in APK_NAMES:
            if name != ABI:
                run(['cp', '-c', source / name, signed / name])
                if digest(signed / name) != sums[name]:
                    raise ValueError(f'Unchanged split differs from original receipt: {name}')
        sums[ABI] = digest(new_abi)
        (signed / 'SHA256SUMS.txt').write_text(
            ''.join(f'{sums[name]}  {name}\n' for name in APK_NAMES))
        (signed / 'build_receipt.json').write_text(json.dumps({
            'changed_split': ABI,
            'changed_member': SCRIPT,
            'signer_sha256': EXPECTED_SIGNER,
            'embedded_script_sha256': digest(compiled),
            'runtime_verified': False,
        }, indent=2) + '\n')
        signed.rename(output)
    print(f'Verified {output}', flush=True)


if __name__ == '__main__':
    main()
