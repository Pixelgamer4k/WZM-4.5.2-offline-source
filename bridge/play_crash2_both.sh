#!/bin/zsh
# Crash 2 with genuine AI bots on BOTH teams.
# Thin wrapper: the known-good play_with_bots.sh recipe stays untouched (it is the
# only launcher that has produced an owner-confirmed playable match), and only two
# things are added:
#   1. WZM_ENEMY_AI=N -> the host enter-world team hook keeps the first N genuine
#      marker-2 bots on team 1 and puts every later one on team 2 (yours).
#   2. after the proven party inject finishes, native_ai_both_sides.js creates the
#      real marker-2 AI roster and native_ai_veteran_guard.js holds them at Veteran.
# Usage: ./play_crash2_both.sh [seconds=1800] [enemy_ai=3] [friendly_ai=3]
set -eu
cd "${0:A:h}"
SECS=${1:-1800}; ENEMIES=${2:-3}; FRIENDS=${3:-3}
[[ "$SECS" == <-> && $SECS -ge 120 && $SECS -le 14400 ]] || { print 'seconds must be 120..14400'; exit 2; }
[[ "$ENEMIES" == <-> && $ENEMIES -ge 1 && $ENEMIES -le 6 ]] || { print 'enemy_ai must be 1..6'; exit 2; }
[[ "$FRIENDS" == <-> && $FRIENDS -ge 0 && $FRIENDS -le 6 ]] || { print 'friendly_ai must be 0..6'; exit 2; }
R=../../runtime/match_entry_20261102
B=../../runtime/bot_fix_20261105
mkdir -p "$B"

export WZM_MAP=mp_mgl_crash2
export WZM_ENEMY_AI=$ENEMIES
export WZM_MENU_RETURN=0
print "Crash 2 both-sides run: $ENEMIES enemy AI (team 1) + $FRIENDS friendly AI (team 2), $SECS s"
./play_with_bots.sh "$SECS" 2 0 > "$B/both_launch.log" 2>&1 &
PLAY=$!
trap 'kill $PLAY 2>/dev/null || true' INT TERM
sleep 4
TAG=$(head -1 "$R/last_play_with_bots.out" | awk '{print $2}' | tr -d ,)
[[ -n "$TAG" ]] || { print 'launcher emitted no session tag'; exit 1; }
print "Session $TAG; waiting for the proven party inject, then the both-sides AI roster"

../../frida_venv/bin/python3 both_sides_bots.py "$TAG" "$ENEMIES" "$FRIENDS" "$B/both_sides.jsonl" &
BOTH=$!
print "Both-sides agent pid $BOTH. Evidence: $B/both_sides.jsonl, $R/$TAG.log"
wait $PLAY
