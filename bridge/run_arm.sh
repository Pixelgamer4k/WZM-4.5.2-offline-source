#!/bin/zsh
# run_arm.sh <tag> [seconds]: boot to the menu, run the match entry trace, print a summary.
T=$1;S=${2:-12};R=${WZM_ROOT:-$(pwd)/..};P=$R/analysis/runtime/match_entry_20261102
mkdir -p $P/boot_$T;cd $R;analysis/frida_tools/lua_bridge/boot_offline.sh 12 $P/boot_$T 2>&1 | tail -1 | cut -c1-80
cd analysis/frida_tools/lua_bridge;../../frida_venv/bin/python3 match_entry_arm.py $S mp_mgl_nuketown $P/$T.json force > $P/$T.log 2>&1
python3 summarize_arm.py $P/$T.log
adb -s PHONE_IP:5555 exec-out screencap -p > $P/$T.png
echo "alive: $(adb -s PHONE_IP:5555 shell pidof com.activision.callofduty.warzone)"
