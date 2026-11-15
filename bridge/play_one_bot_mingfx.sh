#!/bin/zsh
# Test run: 1 bot only, minimal graphics overrides.
# Purpose: prove whether the frame-rate drop comes from our gfx dvar writes rather
# than from the bot roster. Everything else is the proven play_with_bots.sh recipe.
# Usage: ./play_one_bot_mingfx.sh [seconds=1200]
set -eu
cd "${0:A:h}"
SECS=${1:-1200}
R=../../runtime/match_entry_20261102
B=../../runtime/bot_fix_20261105
mkdir -p "$B"

export WZM_MAP=mp_mgl_crash2
export WZM_ENEMY_AI=1
export WZM_MENU_RETURN=0
# Minimal gfx: bypass the full gfx_apply.js profile, install gfx_min.js instead.
export WZM_GFX=1
export WZM_GFX_FIXED640=1
unset WZM_GFX_MIN
export WZM_LOW_OVERHEAD=1

print "1-bot 640p run on Crash 2 for $SECS s"
./play_with_bots.sh "$SECS" 2 0 > "$B/onebot_launch.log" 2>&1 &
PLAY=$!
trap 'kill $PLAY 2>/dev/null || true' INT TERM
sleep 4
TAG=$(head -1 "$R/last_play_with_bots.out" | awk '{print $2}' | tr -d ,)
[[ -n "$TAG" ]] || { print 'no session tag'; exit 1; }
print "Session $TAG; waiting for party inject then a single AI"
../../frida_venv/bin/python3 both_sides_bots.py "$TAG" 1 0 "$B/onebot_bots.jsonl" > "$B/onebot_bots.out" 2>&1 &
print "bot agent pid $!"
wait $PLAY
