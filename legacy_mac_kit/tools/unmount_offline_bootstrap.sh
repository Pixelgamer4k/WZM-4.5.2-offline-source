#!/bin/zsh
# Reverses this package's source-based bind mount; does not delete game data.
set -eu
MODE=${1:---dry-run}
[[ "$MODE" == --dry-run || "$MODE" == --apply ]] || { print -u2 'Usage: unmount_offline_bootstrap.sh [--dry-run|--apply]'; exit 2; }
if [[ "$MODE" == --dry-run ]]; then
  print 'DRY RUN: would unmount the temporary offline bootstrap from the currently installed base.apk.'
  exit 0
fi
[[ -n ${WZM_REAL_ADB:-} && -n ${WZM_DEVICE:-} ]] || { print -u2 'Use ./run.sh unmount --apply with device configured'; exit 2; }
DEV=127.0.0.1:5555;PKG=com.activision.callofduty.warzone
BASE=$(adb -s "$DEV" shell pm path "$PKG" | tr -d '\r' | sed -n 's/^package:\(.*\/base\.apk\)$/\1/p' | head -n1)
[[ "$BASE" == /data/app/*/base.apk ]] || { print -u2 'Expected base APK path not found'; exit 2; }
print 'The game should be closed before unmounting its loaded base APK.'
adb -s "$DEV" shell "su -c 'nsenter -t 1 -m -- umount $BASE'"
print 'Temporary bind mount detached. Installed game files were not modified.'
