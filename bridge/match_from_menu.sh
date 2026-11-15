#!/bin/zsh
# Start a match from the live main menu session started by menu.sh (no game restart, no new hooks),
# then add bots the same way play_mp.sh does once you are in the world.
# Usage: ./match_from_menu.sh <map id> <gametype hash> <enemy AI 1-6> <friendly AI 0-6>
set -u
cd "${0:A:h}"
MAP=$1; GT=$2; ENEMIES=$3; FRIENDS=$4
R=../../runtime/match_entry_20261102; B=../../runtime/bot_fix_20261105; PY=../../frida_venv/bin/python3
TAG=$(head -1 $R/last_menu.out | awk '{print $2}' | tr -d ,)
[[ -n $TAG && -f $R/$TAG.log ]] || { print -u2 "no menu session; run menu.sh first"; exit 1; }
"$PY" save_loadouts.py
"$PY" restore_loadouts.py   # edited loadouts into every set before the match reads them
print -r -- "{\"map\":\"$MAP\",\"gametype\":\"$GT\",\"enemies\":$ENEMIES}" > $R/$TAG.log.go
print "match requested on $MAP (session $TAG)"
until grep -q '"clientEnterWorld"' $R/$TAG.log 2>/dev/null; do sleep 2; done
print "in the match; adding bots"
{ print "globalThis.WZM_BOT_ENV={partyMembers:true,teamFields:false,count:2,team:1,calls:2,friends:0};"; cat party_bot_inject.js; } > _inj_run.js
BOT_TRIGGER=spawn BOT_STAY=1 BOT_WAIT=40 BOT_AGENT=_inj_run.js "$PY" bot_ready_watch.py "$R/$TAG.log" "$R/$TAG.botinject.jsonl" \
  | grep --line-buffered -E 'botInjectFinal|botInjectError' &
exec "$PY" both_sides_bots.py "$TAG" "$ENEMIES" "$FRIENDS" "$B/${TAG}_bots.jsonl"
