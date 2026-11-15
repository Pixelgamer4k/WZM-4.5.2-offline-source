#!/bin/zsh
# Keeps the offline main menu usable: if a UI error resets the game's UI scripts (black screen,
# unlocks gone), re-apply the online-check bypass and the unlocks. Never re-seeds loadouts.
# Also auto-saves Gear Up loadouts to ~/.wzm_loadouts.tsv every 30 s (only when they changed).
# Usage: ./menu_keeper.sh [seconds=7200]   (run while you use the main menu / Gear Up)
cd "${0:A:h}"
PY=../../frida_venv/bin/python3; END=$(( $(date +%s) + ${1:-7200} ))
while [ $(date +%s) -lt $END ]; do
  pid=$(adb -s PHONE_IP:5555 shell pidof com.activision.callofduty.warzone)
  # skip while a match is running (client connected): the in-match UI has no menu unlocks to restore
  st=$(grep -h '"s": "state"' $(ls -t ../../runtime/match_entry_20261102/play_*.log 2>/dev/null | head -1) 2>/dev/null | tail -1 | grep -oE '"clc0": [0-9]+' | grep -oE '[0-9]+$')
  if [ -n "$pid" ] && [ "${st:-0}" -lt 7 ]; then
    r=$("$PY" lua_exec.py check_unlock_state.lua 10 2>/dev/null | tail -1)
    if echo "$r" | grep -q "unlock=false"; then
      print "$(date +%H:%M:%S) UI was reset: restoring main menu and unlocks"
      "$PY" lua_exec.py skip_online_fences.lua 10 >/dev/null 2>&1
      sleep 4
      WZM_SKIP_SEED=1 WZM_NO_OPEN=1 zsh ./unlock_all_menu.sh >/dev/null 2>&1
      print "$(date +%H:%M:%S) restored"
    fi
    n=$(( ${n:-0} + 1 ))
    if (( n % 3 == 0 )); then r2=$("$PY" save_loadouts.py 2>/dev/null); [[ $r2 == saved* ]] && print "$(date +%H:%M:%S) $r2"; fi
  fi
  sleep 10
done
