#!/bin/zsh
# Offline source package setup. Installs only open Python runtime dependencies.
set -eu
ROOT=${0:A:h}
cd "$ROOT"
command -v python3 >/dev/null || { print -u2 'Install Python 3.13 or compatible and retry'; exit 2; }
command -v adb >/dev/null || { print -u2 'Install Android platform-tools/adb and retry'; exit 2; }
command -v zsh >/dev/null || { print -u2 'zsh is required'; exit 2; }
if [[ ${1:-} == --check ]]; then
  print 'Mac dependencies available. No package installation or phone operation performed.'
  exit 0
fi
mkdir -p analysis/runtime/match_entry_20261102 analysis/runtime/bot_fix_20261105 analysis/runtime/user_tools
python3 -m venv analysis/frida_venv
analysis/frida_venv/bin/python3 -m pip install -r requirements.txt
print 'Ready. Configure your own Android ADB serial/IP with ./configure.sh.'
