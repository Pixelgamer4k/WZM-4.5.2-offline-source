#!/bin/zsh
# Keep Mac/ADB connection active: runtime hooks must remain loaded during play.
set -eu
cd "${0:A:h}"
SECONDS_TO_PLAY=${1:-3600}
[[ "$SECONDS_TO_PLAY" == <-> ]] || { print 'Usage: ./play_offline.sh [seconds]'; exit 2; }
# WZM_FAKE_PLAYER_DATA=0 keeps the current profile (used when hosting from the live main menu after Gear Up edits).
export WZM_FAKE_PLAYER_DATA=${WZM_FAKE_PLAYER_DATA:-1} WZM_VM53_STEER_PIN=1 WZM_FORCE_LOOPBACK=1
export WZM_NULL_ENTITY_GUARD=1 WZM_ROUTE_LOCAL_HOST_PACKET=1 WZM_FORCE_OOB_CMD=1 WZM_SEND_GAMESTATE=1
# Fixed 640p internal world rendering is default; legacy 720 switch still works as an opt-out.
export WZM_GFX=${WZM_GFX:-1} WZM_GFX_FIXED640=${WZM_GFX_FIXED640:-${WZM_GFX_FIXED720:-1}}
export WZM_QUIET=1 WZM_MP_MODE=211 WZM_UI_RETRY=1 WZM_LUA_ASSET_CACHE=1 WZM_UI_MISSING_NIL=1
# Perf: read-only network/UI observers cost CPU every frame; WZM_TRACE=1 turns them back on for debugging.
if [[ ${WZM_TRACE:-0} == 1 ]]; then export WZM_CL_RESEND=1 WZM_OBSERVE_CONNECT_ID=1 WZM_UI_LOOKUP_TRACE=1; fi
export WZM_OMNVAR_ADD=0x750bd5872bb1d322 WZM_JOIN_ALLIES=1 WZM_MATCH_PROBE=1
# Loadout: WZM_CLASS=N auto-picks preset N (default 1); WZM_CLASS=pick sends nothing so the game's own
# loadout screen stays up for the player to choose.
if [[ ${WZM_CLASS:-1} == pick ]]; then unset WZM_LUI_SEND; else export WZM_LUI_SEND="class_select:$(( ${WZM_CLASS:-1} - 1 ))@22000"; fi
export WZM_MATCH_LUA_STEPS='17000:hitmarker_scale_state.lua,18000:hitmarker_scale_bind.lua,19000:aa_state.lua,25000:hitmarker_bind_state.lua,30000:hitmarker_bind_state.lua,45000:hitmarker_bind_state.lua,75000:hitmarker_bind_state.lua,120000:hitmarker_bind_state.lua'
tag=play_$(date +%Y%m%d_%H%M%S)
print "Session $tag, runtime $SECONDS_TO_PLAY seconds; keep this process running."
adb connect PHONE_IP:5555 >/dev/null || true
# Main Menu after a match relaunches the game process; patch the relaunched process like a normal boot.
[[ ${WZM_MENU_RETURN:-1} == 1 ]] && { ../../frida_venv/bin/python3 menu_return_watch.py "../../runtime/match_entry_20261102/$tag.log" "$SECONDS_TO_PLAY" > "../../runtime/match_entry_20261102/$tag.menuwatch.log" 2>&1 & }
# WZM_GAMETYPE picks the game mode (default Team Deathmatch).
exec ./run_host.sh "$tag" "$SECONDS_TO_PLAY" ${WZM_MAP:-mp_mgl_nuketown} ${WZM_GAMETYPE:-0x3f9bd6e4038d651d}
