#!/bin/zsh
# Privacy-safe Mac CLI; source and configuration stay separate.
# Always invoke from the portable root or by absolute path; never auto-install APKs.
set -eu
ROOT=${0:A:h}
cd "$ROOT"
BRIDGE="$ROOT/analysis/frida_tools/lua_bridge"
MANAGER="$ROOT/analysis/user_tools/session_manager.py"
PYTHON=$(command -v python3)

case "${1:-help}" in
  help|-h|--help)
    cat <<'HELP'
Warzone Mobile 4.5.2 — standalone portable *source* toolchain (Mac + rooted ARM64 Android)

  ./setup_mac.sh               Create Python venv and install Frida Python bindings
  ./configure.sh SERIAL        Store your own ADB serial/IP privately, outside this folder
  ./run.sh maps                Show map names and current evidence
  ./run.sh modes               Show verified/experimental modes
  ./run.sh doctor              Check local prerequisites and device connectivity
  ./run.sh mount --dry-run     Verify your locally built offline bootstrap (default)
  ./run.sh mount --apply       Reversibly bind-mount onto YOUR already installed game
  ./run.sh unmount --apply     Undo bootstrap bind mount (or reboot phone)
  ./run.sh menu [SECONDS]      Start an offline menu (experimental on other devices)
  ./run.sh loadouts            Unlock/select equipment in the existing game menu
  ./run.sh play MAP ENEMIES FRIENDS [SECONDS]         Verified baseline: TDM + Veteran bots
  ./run.sh experimental MODE MAP ENEMIES FRIENDS [SECONDS]  Native modes; rounds unverified
  ./run.sh stop                Stop ONLY this portable package's managed Mac processes

Examples:
  ./run.sh play crash 2 2 1800
  ./run.sh play nuketown 5 0 3600
  ./run.sh experimental sd crash 2 2 1800

Important: All game assets, APKs and proprietary binaries must be supplied by the
owner from the exact original 4.5.2 installation. Only TDM is gameplay-verified.
HELP
    exit 0 ;;
  maps|modes)
    exec zsh "$ROOT/analysis/user_tools/wzm_terminal.sh" "$1" ;;
  stop)
    exec "$PYTHON" "$MANAGER" stop ;;
esac

if [[ -r "$HOME/.config/wzm452-offline/device.sh" ]]; then
  source "$HOME/.config/wzm452-offline/device.sh"
fi
[[ -n ${WZM_DEVICE:-} ]] || { print -u2 'Configure a device with ./configure.sh SERIAL (or export WZM_DEVICE).'; exit 2; }
WZM_REAL_ADB=$(command -v adb || true)
[[ -n "$WZM_REAL_ADB" ]] || { print -u2 'Missing Android platform-tools (adb).'; exit 2; }
export WZM_DEVICE WZM_REAL_ADB WZM_SOURCE_ROOT="$ROOT"
# Avoid repeating force-stops when a game stalls at the logo.
export WZM_BOOT_TRIES=${WZM_BOOT_TRIES:-1}
export PATH="$ROOT/bin:$PATH"
VENV="$ROOT/analysis/frida_venv/bin/python3"
case "$1" in
  doctor)
    [[ -x "$VENV" ]] || { print -u2 'Run ./setup_mac.sh first'; exit 2; }
    print 'Checking package prerequisites (read-only)...'
    "$VENV" -c 'import frida; print("Frida Python:", frida.__version__)'
    adb -s 127.0.0.1:5555 get-state
    adb -s 127.0.0.1:5555 shell 'getprop ro.product.cpu.abi; pidof com.activision.callofduty.warzone || true'
    print 'ADB connection checked. Not proof game, root, cache or native patch works.'
    ;;
  mount|unmount)
    SUB=$1; shift
    if [[ $SUB == mount ]]; then
      exec zsh "$ROOT/tools/mount_offline_bootstrap.sh" "${1:---dry-run}"
    else
      exec zsh "$ROOT/tools/unmount_offline_bootstrap.sh" "${1:---dry-run}"
    fi
    ;;
  play|experimental|menu|loadouts)
    [[ -x "$VENV" ]] || { print -u2 'Run ./setup_mac.sh first'; exit 2; }
    mkdir -p "$ROOT/analysis/runtime/match_entry_20261102" "$ROOT/analysis/runtime/bot_fix_20261105" "$ROOT/analysis/runtime/user_tools"
    ;;
  *) print -u2 "Unknown command: $1. Run ./run.sh --help"; exit 2 ;;
esac

case "$1" in
  play)
    shift
    [[ $# -ge 3 ]] || { print -u2 'Usage: ./run.sh play MAP ENEMIES FRIENDS [SECONDS]'; exit 2; }
    exec zsh "$ROOT/analysis/user_tools/wzm_terminal.sh" play "$@"
    ;;
  experimental)
    shift
    [[ $# -ge 4 ]] || { print -u2 'Usage: ./run.sh experimental MODE MAP ENEMIES FRIENDS [SECONDS]'; exit 2; }
    MODE=$1; shift
    case "$MODE" in
      sd|snd|search-and-destroy) GT=0x1dbcd710fe215368 ;;
      dom|domination) GT=0x6cec28f740df15db ;;
      hardpoint|koth) GT=0x7727d380d55d0e58 ;;
      kill-confirmed|conf) GT=0x39e8297d7f7df31d ;;
      frontline|front) GT=0x7aa5ae4c378e7c80 ;;
      *) print -u2 "Unknown/unverified gametype name: $MODE"; exit 2 ;;
    esac
    print -u2 "EXPERIMENTAL native gametype $MODE ($GT): rounds, objectives and bots in this mode are NOT validated."
    export WZM_GAMETYPE="$GT"
    exec zsh "$ROOT/analysis/user_tools/wzm_terminal.sh" play "$@"
    ;;
  menu)
    shift
    SECS=${1:-14400}
    [[ "$SECS" == <-> && "$SECS" -ge 120 && "$SECS" -le 14400 ]] || { print -u2 'Menu duration must be 120–14400 seconds'; exit 2; }
    exec "$PYTHON" "$MANAGER" run -- zsh "$BRIDGE/menu.sh" "$SECS"
    ;;
  loadouts)
    exec zsh "$BRIDGE/unlock_all_menu.sh"
    ;;
esac
