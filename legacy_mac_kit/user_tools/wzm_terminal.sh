#!/bin/zsh
# Personal, standalone Mac Terminal launcher for the existing Warzone Mobile offline project.
# Does not change existing launchers, original game files, or saved game state.
# Only an explicit `play`, `solo`, `loadout-boot`, or `loadouts` command touches the game.
set -eu

ROOT=${0:A:h:h:h}
BRIDGE="$ROOT/analysis/frida_tools/lua_bridge"
MANAGER="$ROOT/analysis/user_tools/session_manager.py"
DEVICE=${WZM_DEVICE:-127.0.0.1:5555}

usage() {
  cat <<'EOF'
Warzone Mobile offline — Mac Terminal self-service

  zsh analysis/user_tools/wzm_terminal.sh maps
  zsh analysis/user_tools/wzm_terminal.sh modes
  zsh analysis/user_tools/wzm_terminal.sh status
  zsh analysis/user_tools/wzm_terminal.sh stop
  zsh analysis/user_tools/wzm_terminal.sh play MAP ENEMIES FRIENDLIES [SECONDS=3600]
  zsh analysis/user_tools/wzm_terminal.sh solo MAP [SECONDS=3600]
  zsh analysis/user_tools/wzm_terminal.sh loadout-boot [MAP=crash] [SECONDS=3600]
  zsh analysis/user_tools/wzm_terminal.sh loadouts

Examples:
  zsh analysis/user_tools/wzm_terminal.sh play crash 1 1 1800
  zsh analysis/user_tools/wzm_terminal.sh play nuketown 5 0 3600
  zsh analysis/user_tools/wzm_terminal.sh play verdansk 2 0 3600

play: TDM only, bots are Veteran. Enemies 1..6, friendlies 0..6, total <=8.
solo: experimental no-AI-bot session; empty enemy team may forfeit.
loadout-boot: starts a warm-up Crash TDM match with one enemy bot.
  On the phone choose Pause > Main Menu; in a SECOND Mac terminal run `loadouts`.
  A cold menu-only boot does not support the complete loadout editor.

WARNING: Launching a match cold-boots/replaces an existing live game session.
Ctrl+C now terminates its entire Mac launcher process group, including watchers.
`stop` cleans abandoned watchers from earlier runs without killing the Android app.
Keep the launch terminal open. See analysis/user_tools/README_TERMINAL_CUSTOM_MATCH.md.
EOF
}

map_id() {
  case "$1" in
    crash|mp_mgl_crash2) print mp_mgl_crash2 ;;
    nuketown|mp_mgl_nuketown) print mp_mgl_nuketown ;;
    hardhat|mp_mgl_hardhat) print mp_mgl_hardhat ;;
    slaughterhouse|mp_mgl_slaughterhouse) print mp_mgl_slaughterhouse ;;
    downtown|ftue|mp_mgl_ftue_downtown) print mp_mgl_ftue_downtown ;;
    rebirth|rebirth-island|mp_mgl_escape4) print mp_mgl_escape4 ;;
    verdansk|sierra|mp_mgl_wz2_sierra) print mp_mgl_wz2_sierra ;;
    *) print -u2 "Unavailable or unknown map: $1"; return 2 ;;
  esac
}

is_number_in_range() {
  local n=$1 lower=$2 upper=$3
  [[ "$n" == <-> ]] && (( n >= lower && n <= upper ))
}

maps() {
  cat <<'EOF'
  crash        mp_mgl_crash2           owner-played, genuine bots verified
  nuketown     mp_mgl_nuketown         owner-played, genuine bots verified
  verdansk     mp_mgl_wz2_sierra       owner-played after pack registry fix
  rebirth      mp_mgl_escape4          historical gameplay, bots less verified
  hardhat      mp_mgl_hardhat          available zone, gameplay not confirmed
  slaughterhouse mp_mgl_slaughterhouse available zone, gameplay not confirmed
  downtown     mp_mgl_ftue_downtown    available FTUE zone, not normal MP verified

Original PC IW8 Rust/Shipment are not installable/playable yet; Hijacked is absent.
EOF
}

modes() {
  cat <<'EOF'
  TDM / Team Deathmatch: VERIFIED (0x3f9bd6e4038d651d)
  Domination, Hardpoint, Frontline, Kill Confirmed, Search & Destroy:
    Original native game-type entries identified, but objective and round rules
    NOT GAMEPLAY-VERIFIED. Use ./run.sh experimental MODE ... only at your risk.
  Search & Destroy: original mp_sd hash 0x1dbcd710fe215368.
  Native gametype selection does not guarantee plant/defuse or multi-round AI.
EOF
}

play_match() {
  local map=${1:-} enemies=${2:-} friends=${3:-} seconds=${4:-3600}
  [[ -n "$map" ]] || { usage; return 2; }
  map_id "$map" >/dev/null || return 2
  is_number_in_range "$enemies" 1 6 || { print -u2 'Enemy AI must be 1..6'; return 2; }
  is_number_in_range "$friends" 0 6 || { print -u2 'Friendly AI must be 0..6'; return 2; }
  (( enemies + friends <= 8 )) || { print -u2 'Actual native AI creator supports at most 8 total; rejecting larger roster.'; return 2; }
  is_number_in_range "$seconds" 120 14400 || { print -u2 'Session seconds must be 120..14400'; return 2; }
  if [[ -n ${WZM_GAMETYPE:-} && "$WZM_GAMETYPE" != 0x3f9bd6e4038d651d ]]; then
    print "Cold-boot experimental gametype $WZM_GAMETYPE on $map: $enemies enemy, $friends friendly Veteran AI, $seconds seconds"
  else
    print "Cold-boot verified-baseline TDM $map: $enemies enemy, $friends friendly Veteran AI, $seconds seconds"
  fi
  exec python3 "$MANAGER" run -- zsh "$BRIDGE/play_mp.sh" "$map" "$enemies" "$friends" "$seconds"
}

solo_match() {
  local map=${1:-} seconds=${2:-3600}
  [[ -n "$map" ]] || { usage; return 2; }
  local id
  id=$(map_id "$map") || return 2
  is_number_in_range "$seconds" 120 14400 || { print -u2 'Session seconds must be 120..14400'; return 2; }
  print -u2 'EXPERIMENTAL: no AI bots will be created; an empty enemy team may cause an immediate victory/forfeit.'
  export WZM_MAP="$id" WZM_MENU_RETURN=1
  if [[ "$id" == mp_mgl_wz2_sierra ]]; then
    export WZM_PACK_INSTALLED=verdansk_pack_files.json WZM_GFX_TEX=${WZM_GFX_TEX:-0}
  fi
  exec python3 "$MANAGER" run -- zsh "$BRIDGE/play_offline.sh" "$seconds"
}

status() {
  python3 "$MANAGER" status
  if ! command -v adb >/dev/null 2>&1; then print 'adb not installed/on PATH'; return 1; fi
  print "Device $DEVICE (read-only checks):"
  adb -s "$DEVICE" get-state 2>&1 || return 1
  adb -s "$DEVICE" shell 'pidof com.activision.callofduty.warzone || true; dumpsys battery | grep -E "level:|status:"' 2>&1 || true
}

cmd=${1:-help}
if (( $# )); then shift; fi
case "$cmd" in
  help|-h|--help) usage ;;
  maps) maps ;;
  modes) modes ;;
  status) status ;;
  stop) exec python3 "$MANAGER" stop ;;
  play) play_match "$@" ;;
  solo) solo_match "$@" ;;
  loadout-boot)
    print 'This launches a warm-up match (one Veteran enemy). On the phone: Pause > Main Menu.'
    print 'After reaching the menu, run `zsh analysis/user_tools/wzm_terminal.sh loadouts` in a SECOND Mac terminal.'
    play_match "${1:-crash}" 1 0 "${2:-3600}" ;;
  loadouts)
    print 'Requires an ALREADY RUNNING main menu reached after a match. No cold boot is performed.'
    exec zsh "$BRIDGE/unlock_all_menu.sh" ;;
  *) print -u2 "Unknown command: $cmd"; usage; exit 2 ;;
esac
