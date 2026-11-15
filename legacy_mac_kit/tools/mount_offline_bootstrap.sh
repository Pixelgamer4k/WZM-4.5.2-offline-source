#!/bin/zsh
# Reversible root bind-mount for an app that the owner installed themselves.
# Default DRY RUN: only --apply interacts with Android. Never uninstall/clear data.
set -eu
MODE=${1:---dry-run}
[[ "$MODE" == --dry-run || "$MODE" == --apply ]] || { print -u2 'Usage: mount_offline_bootstrap.sh [--dry-run|--apply]'; exit 2; }
APK=${WZM_BOOTSTRAP_APK:-"$HOME/.local/share/wzm452/base_offline_boot.apk"}
EXPECTED=1a2065b43623364895892b73b5d0be7d42ad345f7742f6aed83fcd164994f6e9
REMOTE=/data/local/tmp/wzm452_offline_boot.apk
PKG=com.activision.callofduty.warzone
[[ -r "$APK" ]] || { print -u2 'Private bootstrap not generated. Run tools/build_offline_bootstrap.py with your own original base.apk first.'; exit 2; }
ACTUAL=$(shasum -a 256 "$APK" | awk '{print $1}')
[[ "$ACTUAL" == "$EXPECTED" ]] || { print -u2 'Wrong bootstrap SHA256. Refusing.'; exit 2; }
if [[ "$MODE" == --dry-run ]]; then
  print 'DRY RUN: matching user-built bootstrap SHA verified.'
  print 'Would push a local bootstrap to the phone and bind-mount it over the already installed base.apk.'
  print 'No installed APK, game data, or cache files would be overwritten.'
  exit 0
fi
[[ -n ${WZM_REAL_ADB:-} && -n ${WZM_DEVICE:-} ]] || { print -u2 'Use ./run.sh mount --apply with your configured device'; exit 2; }
DEV=127.0.0.1:5555
[[ "$(adb -s "$DEV" get-state)" == device ]] || { print -u2 'ADB device not online'; exit 2; }
ROOT=$(adb -s "$DEV" shell "su -c 'id -u'" 2>/dev/null | tr -d '\r\n')
[[ "$ROOT" == 0 ]] || { print -u2 'Root access is required; refusing.'; exit 2; }
BASE=$(adb -s "$DEV" shell pm path "$PKG" | tr -d '\r' | sed -n 's/^package:\(.*\/base\.apk\)$/\1/p' | head -n1)
[[ "$BASE" == /data/app/*/base.apk ]] || { print -u2 'Expected official installed game base.apk not found'; exit 2; }
print 'Copying private offline bootstrap to the rooted device (not altering installed APK)...'
adb -s "$DEV" push "$APK" "$REMOTE" >/dev/null
PHONE_SHA=$(adb -s "$DEV" shell "su -c 'sha256sum $REMOTE'" | awk '{print $1}')
[[ "$PHONE_SHA" == "$EXPECTED" ]] || { print -u2 'On-device transfer checksum mismatch; no mount performed'; exit 1; }
adb -s "$DEV" shell "su -c 'nsenter -t 1 -m -- mount --bind $REMOTE $BASE'"
print 'Root bind mount applied. It is volatile, and can be undone with ./run.sh unmount --apply or a reboot.'
print 'Not a proof that the game/menu works on this particular device.'
