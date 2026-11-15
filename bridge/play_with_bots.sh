#!/bin/zsh
# Offline Nuketown TDM with enemy bots. Keep this running while you play.
# Usage: ./play_with_bots.sh [seconds] [enemy_bots] [friendly_bots]
#
# RETRY LIMIT: a launch retry re-runs boot_offline.sh, which force-stops the game.
# On a hot or low-battery phone the boot stalls, so retries presented to the player as
# repeated crashes. Default is a single attempt; override with WZM_PLAY_ATTEMPTS.
set -eu
cd "${0:A:h}"
SECS=${1:-3600}; ENEMIES=${2:-5}; FRIENDS=${3:-0}
R=../../runtime/match_entry_20261102
export WZM_BOTS=1 WZM_GAMESTATE_RETRY=0 WZM_NATIVE_BOT_ONCE=0 WZM_NATIVE_BOT_CONNECT=0
ATTEMPTS=${WZM_PLAY_ATTEMPTS:-1}
for attempt in $(seq 1 $ATTEMPTS); do
  ./play_offline.sh "$SECS" > "$R/last_play_with_bots.out" 2>&1 &
  PLAY=$!
  trap 'kill $PLAY 2>/dev/null' INT TERM
  sleep 2
  TAG=$(head -1 "$R/last_play_with_bots.out" | awk '{print $2}' | tr -d ,)
  while kill -0 $PLAY 2>/dev/null && ! grep -q '"clientEnterWorld"' "$R/$TAG.log" 2>/dev/null; do sleep 2; done
  if grep -q '"clientEnterWorld"' "$R/$TAG.log" 2>/dev/null; then break; fi
  print "Launch attempt $attempt/$ATTEMPTS failed ($(tail -1 $R/last_play_with_bots.out))"
  [[ $attempt -lt $ATTEMPTS ]] && print "retrying; this force-stops and reboots the game" || print "not retrying further; leaving the device alone"
done
print "Session $TAG: waiting for your player to spawn, then adding $ENEMIES enemy + $FRIENDS friendly bots"
{ print "globalThis.WZM_BOT_ENV={partyMembers:true,teamFields:false,count:$ENEMIES,team:1,calls:$((ENEMIES+FRIENDS)),friends:$FRIENDS};"; cat party_bot_inject.js; } > _inj_run.js
BOT_TRIGGER=${BOT_TRIGGER:-spawn} BOT_STAY=1 BOT_WAIT=40 BOT_AGENT=_inj_run.js ../../frida_venv/bin/python3 bot_ready_watch.py "$R/$TAG.log" "$R/$TAG.botinject.jsonl" \
  | grep --line-buffered -E 'botAddTestClient|botInjectFinal|botInjectError|botAgentStaying|botNullSend' || print 'bot injection did not complete; game keeps running without bots'
print "Bots step done. Game stays up for $SECS s from start; Ctrl-C ends it."
wait $PLAY
