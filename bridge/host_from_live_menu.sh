#!/bin/zsh
# Start the offline multiplayer host from an already-running frontend menu.
# Unlike play_mp.sh, this does not cold-boot the app.
set -eu
cd "${0:A:h}"
MAP=${1:-mp_mgl_crash2}
SECS=${2:-3600}
[[ "$SECS" == <-> && $SECS -ge 120 && $SECS -le 14400 ]] || { print -u2 'seconds must be 120..14400'; exit 2; }
LOG=../../runtime/match_entry_20261102/live_menu_${MAP}_$(date +%Y%m%d_%H%M%S).jsonl

export WZM_VM53_STEER_PIN=1 WZM_FORCE_LOOPBACK=1 WZM_CL_RESEND=1
export WZM_NULL_ENTITY_GUARD=1 WZM_ROUTE_LOCAL_HOST_PACKET=1 WZM_OBSERVE_CONNECT_ID=1
export WZM_FORCE_OOB_CMD=1 WZM_SEND_GAMESTATE=1 WZM_GFX=1 WZM_GFX_FIXED640=1
export WZM_QUIET=1 WZM_MP_MODE=211 WZM_UI_RETRY=1 WZM_LUA_ASSET_CACHE=1
export WZM_UI_LOOKUP_TRACE=1 WZM_UI_MISSING_NIL=1 WZM_OMNVAR_ADD=0x750bd5872bb1d322
export WZM_JOIN_ALLIES=1 WZM_LUI_SEND='class_select:0@22000' WZM_MATCH_PROBE=1 WZM_ENEMY_AI=2
export WZM_MATCH_LUA_STEPS='17000:hitmarker_scale_state.lua,18000:hitmarker_scale_bind.lua,19000:aa_state.lua,25000:hitmarker_bind_state.lua,30000:hitmarker_bind_state.lua,45000:hitmarker_bind_state.lua,75000:hitmarker_bind_state.lua,120000:hitmarker_bind_state.lua'

print "Preparing profile in the live menu for $MAP"
../../frida_venv/bin/python3 fake_player_data.py
print "Starting TDM host on $MAP; log $LOG"
exec ../../frida_venv/bin/python3 host_spawn.py "$SECS" "$MAP" 0x3f9bd6e4038d651d "$LOG"
