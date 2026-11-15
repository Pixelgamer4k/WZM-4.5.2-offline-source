#!/bin/zsh
# One non-simulating occupant on the ENEMY team, empty match otherwise.
# Party prime + 640p profile unchanged. No AI, no class select, no Veteran setter.
# Usage: ./play_observer_occupant.sh [seconds=1200]
set -eu
cd "${0:A:h}"
SECS=${1:-1200}
B=../../runtime/bot_fix_20261105
mkdir -p "$B"
export WZM_MAP=mp_mgl_crash2
export WZM_ENEMY_AI=1          # keep the single marker-2 client on team 1 (enemy)
export WZM_MENU_RETURN=0
print "observer-occupant run: Crash 2, one team-1 client entered, nothing simulating"
./play_with_bots.sh "$SECS" 2 0 > "$B/observer_launch.log" 2>&1 &
PLAY=$!
trap 'kill $PLAY 2>/dev/null || true' INT TERM
../../frida_venv/bin/python3 observer_occupant.py "$B/observer_occupant.jsonl" > "$B/observer_occupant.out" 2>&1 &
print "occupant agent pid $!"
wait $PLAY
