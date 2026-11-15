#!/usr/bin/env python3
"""No-device smoke tests; never launches or modifies the Android game."""
import json
import os
import pathlib
import subprocess
import sys
import tempfile

ROOT=pathlib.Path(__file__).resolve().parents[1]

def run(cmd,expected=0,env=None):
    r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,env=env,timeout=20)
    if r.returncode != expected:
        print('BAD EXIT',cmd,'expected',expected,'got',r.returncode, '\n',r.stdout,r.stderr)
        raise AssertionError(cmd)
    return r.stdout+r.stderr


def main():
    with tempfile.TemporaryDirectory(prefix='wzm-source-tests-') as h:
        env=os.environ.copy();env['HOME']=h
        env.pop('WZM_DEVICE',None)
        assert 'source' in run(['zsh','./run.sh','--help'],env=env).lower()
        assert 'crash' in run(['zsh','./run.sh','maps'],env=env)
        assert 'Search & Destroy' in run(['zsh','./run.sh','modes'],env=env)
        assert 'No leftover controllers' in run([sys.executable,'analysis/user_tools/session_manager.py','stop'],env=env)
        assert 'Configure a device' in run(['zsh','./run.sh','doctor'],expected=2,env=env)
        assert 'Unavailable or unknown map' in run(['zsh','analysis/user_tools/wzm_terminal.sh','play','inventedmap','2','2','1800'],expected=2,env=env)
        assert 'at most 8' in run(['zsh','analysis/user_tools/wzm_terminal.sh','play','crash','6','6','1800'],expected=2,env=env)
        assert 'DRY RUN' in run(['zsh','tools/unmount_offline_bootstrap.sh','--dry-run'],env=env)
        bad=pathlib.Path(h)/'incorrect.apk';bad.write_bytes(b'not a real game APK')
        assert 'mismatch' in run([sys.executable,'tools/build_offline_bootstrap.py','--input',str(bad),'--check-only'],expected=1,env=env)
        print('PASS: safe help, map/mode listing, isolated stop, missing config, invalid map/count, dry-run unmount, wrong APK refusal')
    return 0

if __name__=='__main__':sys.exit(main())
