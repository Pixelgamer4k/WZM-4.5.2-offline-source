#!/bin/zsh
# Experimental real native-AI bot roster; retains original known-good launchers.
# Usage: ./play_with_native_ai.sh [seconds=3600] [enemy_ai=2]
set -eu
cd "${0:A:h}"
SECS=${1:-3600}
ENEMIES=${2:-2}
[[ "$SECS" == <-> && $SECS -ge 60 && $SECS -le 14400 ]] || { print 'seconds must be 60..14400'; exit 2; }
[[ "$ENEMIES" == <-> && $ENEMIES -ge 1 && $ENEMIES -le 8 ]] || { print 'enemy_ai must be 1..8'; exit 2; }
R=../../runtime/match_entry_20261102
export WZM_BOTS=1

# Same full-start retry pattern as the proved play_with_bots.sh, but without
# addtestclient or a concurrently running party-bot injection server gate.
READY=0
for attempt in 1 2 3; do
  ./play_offline.sh "$SECS" > "$R/last_play_with_native_ai.out" 2>&1 &
  PLAY=$!
  trap 'kill $PLAY 2>/dev/null || true' INT TERM
  sleep 2
  TAG=$(head -1 "$R/last_play_with_native_ai.out" | awk '{print $2}' | tr -d ,)
  [[ -n "$TAG" ]] || { print 'Launcher did not emit a session tag'; exit 1; }
  while kill -0 $PLAY 2>/dev/null && ! grep -q '"clientEnterWorld"' "$R/$TAG.log" 2>/dev/null; do sleep 2; done
  if grep -q '"clientEnterWorld"' "$R/$TAG.log" 2>/dev/null; then READY=1;break;fi
  print "Native AI launch attempt $attempt failed; trying a fresh baseline boot"
done
if [[ $READY -ne 1 ]]; then
  print "No real player entry; no bots were injected. See $R/last_play_with_native_ai.out"
  exit 1
fi

print "Session $TAG: creating up to $ENEMIES real enemy AI clients at Veteran after player spawn"
../../frida_venv/bin/python3 native_ai_roster_watch.py "$R/$TAG.log" \
  "$R/$TAG.native_ai_roster.jsonl" "$ENEMIES" "$SECS" \
  | tee "$R/$TAG.native_ai_roster.console.txt"
print "Match controller result follows ($R/$TAG.log)"
wait $PLAY
