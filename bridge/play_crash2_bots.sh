#!/bin/zsh
# Crash 2 with real bots. One bot script attaches after spawn and then detaches.
# Usage: ./play_crash2_bots.sh [seconds=3600] [bots=4]
set -eu
cd "${0:A:h}"
SECS=${1:-3600}
BOTS=${2:-4}
[[ "$SECS" == <-> && $SECS -ge 60 && $SECS -le 14400 ]] || { print 'seconds must be 60..14400'; exit 2; }
[[ "$BOTS" == <-> && $BOTS -ge 1 && $BOTS -le 4 ]] || { print 'bots must be 1..4'; exit 2; }
R=../../runtime/match_entry_20261102
export WZM_MAP=mp_mgl_crash2 WZM_BOTS=1
READY=0
TAG=
for attempt in 1 2 3; do
  ./play_offline.sh "$SECS" > "$R/last_play_crash2.out" 2>&1 &
  PLAY=$!
  trap 'kill $PLAY 2>/dev/null || true' INT TERM
  sleep 2
  TAG=$(head -1 "$R/last_play_crash2.out" | awk '{print $2}' | tr -d ,)
  [[ -n "$TAG" ]] || { print 'Launcher did not emit a session tag'; exit 1; }
  while kill -0 $PLAY 2>/dev/null && ! grep -q '"clientEnterWorld"' "$R/$TAG.log" 2>/dev/null; do sleep 2; done
  if grep -q '"clientEnterWorld"' "$R/$TAG.log" 2>/dev/null; then READY=1; break; fi
  print "Crash 2 launch attempt $attempt failed; trying a fresh boot"
done
if [[ $READY -ne 1 ]]; then
  print "No real player entry. See $R/last_play_crash2.out"
  exit 1
fi
print "Session $TAG entered Crash 2; adding $BOTS real bots"
../../frida_venv/bin/python3 crash2_real_bots.py "$R/$TAG.log" "$R/$TAG.crash2_bots.jsonl" "$BOTS"
print "Bot script detached. Match stays up."
wait $PLAY
