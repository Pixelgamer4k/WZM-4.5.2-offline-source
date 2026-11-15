#!/bin/zsh
# Launch a multiplayer/TDM session on a known map with genuine Veteran AI bots.
# Usage: ./play_mp.sh [map=crash] [enemy_ai=2] [friendly_ai=0] [seconds=3600]
set -eu
cd "${0:A:h}"

if [[ ${1:-} == -h || ${1:-} == --help ]]; then
  cat <<'HELP'
Usage: ./play_mp.sh [map] [enemy_ai=2] [friendly_ai=0] [seconds=3600]
Maps: crash, nuketown, hardhat, slaughterhouse, downtown, rebirth, verdansk
Known internal IDs: mp_mgl_crash2, mp_mgl_nuketown, mp_mgl_hardhat,
mp_mgl_slaughterhouse, mp_mgl_ftue_downtown, mp_mgl_escape4.
Verdansk is mp_mgl_wz2_sierra; it requires the full scenario shards staged
in the device cache before launch. Hijacked is not present in this build.
Maps beyond Crash/Nuketown have not all been bot-tested.
This launcher cold-boots the game; keep the terminal open while playing.
HELP
  exit 0
fi

MAP=${1:-crash}; ENEMIES=${2:-2}; FRIENDS=${3:-0}; SECS=${4:-3600}
case "$MAP" in
  crash|mp_mgl_crash2) MAP_ID=mp_mgl_crash2 ;;
  nuketown|mp_mgl_nuketown) MAP_ID=mp_mgl_nuketown ;;
  hardhat|mp_mgl_hardhat) MAP_ID=mp_mgl_hardhat ;;
  slaughterhouse|mp_mgl_slaughterhouse) MAP_ID=mp_mgl_slaughterhouse ;;
  downtown|ftue|mp_mgl_ftue_downtown) MAP_ID=mp_mgl_ftue_downtown ;;
  rebirth|rebirth-island|mp_mgl_escape4) MAP_ID=mp_mgl_escape4 ;;
  verdansk|sierra|mp_mgl_wz2_sierra) MAP_ID=mp_mgl_wz2_sierra ;;
  *) print -u2 "Unknown/unavailable map: $MAP (use --help)"; exit 2 ;;
esac
[[ "$SECS" == <-> && $SECS -ge 120 && $SECS -le 14400 ]] || { print -u2 'seconds must be 120..14400'; exit 2; }
[[ "$ENEMIES" == <-> && $ENEMIES -ge 1 && $ENEMIES -le 6 ]] || { print -u2 'enemy_ai must be 1..6'; exit 2; }
[[ "$FRIENDS" == <-> && $FRIENDS -ge 0 && $FRIENDS -le 6 && $ENEMIES+$FRIENDS -le 8 ]] || { print -u2 'friendly_ai must be 0..6 and total AI <= 8 (bot creator limit)'; exit 2; }

R=../../runtime/match_entry_20261102
B=../../runtime/bot_fix_20261105
mkdir -p "$B"
export WZM_MAP=$MAP_ID WZM_ENEMY_AI=$ENEMIES WZM_MENU_RETURN=1
# Verdansk's pack is installed on disk but the game's registry marks it not installed offline; fix that in memory.
if [[ $MAP_ID == mp_mgl_wz2_sierra ]]; then
  export WZM_PACK_INSTALLED=verdansk_pack_files.json
  # Very High textures overflow the stock streaming pool on this huge map (blocky trunks); keep game defaults.
  export WZM_GFX_TEX=${WZM_GFX_TEX:-0}
fi
# Owner rule: never wait on a logo stall; short grace/probe and several quick restarts.
export WZM_BOOT_TRIES=${WZM_BOOT_TRIES:-5} WZM_BOOT_WAIT=${WZM_BOOT_WAIT:-25} WZM_BOOT_PROBE_WAIT=${WZM_BOOT_PROBE_WAIT:-30} WZM_PLAY_ATTEMPTS=${WZM_PLAY_ATTEMPTS:-1}
export WZM_LOW_OVERHEAD=1
LOG="$B/${MAP_ID}_$(date +%Y%m%d_%H%M%S).log"
print "Launching TDM on $MAP_ID: $ENEMIES enemy + $FRIENDS friendly Veteran AI; log $LOG"
./play_with_bots.sh "$SECS" 2 0 > "$LOG" 2>&1 &
PLAY=$!
trap 'kill $PLAY 2>/dev/null || true' INT TERM
sleep 4
TAG=$(head -1 "$R/last_play_with_bots.out" | awk '{print $2}' | tr -d ,)
[[ -n "$TAG" ]] || { print -u2 "No session tag; inspect $LOG"; exit 1; }
print "Session $TAG; starting genuine two-sided AI injector"
../../frida_venv/bin/python3 both_sides_bots.py "$TAG" "$ENEMIES" "$FRIENDS" "$B/${TAG}_bots.jsonl" &
wait $PLAY
