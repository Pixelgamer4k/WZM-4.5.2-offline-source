#!/bin/zsh
# run_host.sh <tag> [seconds] [map] [gametype hash]: boot to the menu, start the built-in host, log and screenshot.
set -o pipefail
T=$1;S=${2:-15};M=${3:-mp_mgl_nuketown};G=${4:-0x763e0e0566b83935};R=${WZM_ROOT:-$(pwd)/..};P=$R/analysis/runtime/match_entry_20261102
cd "$R"
if [[ ${WZM_REUSE_MENU:-0} == 1 ]]; then
  (cd analysis/frida_tools/lua_bridge && ../../frida_venv/bin/python3 boot_ready.py 10) || {
    echo 'Current menu is unavailable; host not started'
    exit 1
  }
else
  mkdir -p $P/boot_$T
  if ! analysis/frida_tools/lua_bridge/boot_offline.sh 12 $P/boot_$T 2>&1 | tee $P/$T.boot.log | tail -1 | cut -c1-80; then echo "boot failed; host not started"; exit 1; fi
fi
if [[ $WZM_FAKE_PLAYER_DATA == 1 ]]; then (cd analysis/frida_tools/lua_bridge;../../frida_venv/bin/python3 fake_player_data.py) || { echo 'player data failed; host not started'; exit 1; }; fi
# Saved Gear Up loadouts (~/.wzm_loadouts.tsv) into every loadout set, so matches use them.
(cd analysis/frida_tools/lua_bridge;../../frida_venv/bin/python3 restore_loadouts.py) || true
[[ -n $WZM_MODE_REQUEST ]] && (cd analysis/frida_tools/lua_bridge;../../frida_venv/bin/python3 mode_request.py $WZM_MODE_REQUEST 30)
# logcat capture is debug-only (extra CPU/IO on the phone during a match); WZM_TRACE=1 turns it back on
if [[ ${WZM_TRACE:-0} == 1 ]]; then adb -s PHONE_IP:5555 logcat -c;(adb -s PHONE_IP:5555 logcat -v time > $P/$T.logcat &); fi
cd analysis/frida_tools/lua_bridge;../../frida_venv/bin/python3 host_spawn.py $S $M $G $P/$T.log 2>&1 | cut -c1-700
adb -s PHONE_IP:5555 exec-out screencap -p > $P/$T.png
pkill -f "logcat -v time";echo "alive: $(adb -s PHONE_IP:5555 shell pidof com.activision.callofduty.warzone)"
