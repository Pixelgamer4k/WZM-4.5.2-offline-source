#!/bin/zsh
# Save target device settings OUTSIDE the distributable source folder.
set -eu
ROOT=${0:A:h}
CONF="$HOME/.config/wzm452-offline/device.sh"
if [[ -n ${1:-} ]]; then SERIAL=$1
else
  print 'Enter Android ADB serial, or IP:port:'
  read -r SERIAL
fi
[[ -n "$SERIAL" && "$SERIAL" != *"'"* && "$SERIAL" != *' '* ]] || { print -u2 'Invalid ADB device identifier'; exit 2; }
mkdir -p "${CONF:h}"
( umask 077; print -r -- "export WZM_DEVICE='$SERIAL'" > "$CONF" )
chmod 600 "$CONF"
print 'Saved local device configuration outside the source folder (private).'
print 'The source folder contains no device address or serial.'
