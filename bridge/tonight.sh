#!/bin/zsh
# tonight.sh <step> [arg]: one command per experiment, each prints a short summary.
#   modes          list the game mode table (read-only) during a normal host run
#   map <N>        switch to mode N before host start, so the level request can fire
#   scene [name]   menu only: fake data, then request a lobby 3D scene
#   hash           menu only: look for the missing UI module's hash in memory (control included)
#   world          the known-good run, for comparison
#   mp [secs] [N]  multiplayer Nuketown with the UI fixes (mode byte forced, tutorial game type)
#   mpreal [secs]  menu requests mp_mgl (game applies it), then host with GT (default war)
# Screenshots and logs land in analysis/runtime/match_entry_20261102/<tag>.*
cd "${0:A:h}"
R=../../runtime/match_entry_20261102
PY=../../frida_venv/bin/python3
BASE=(WZM_FAKE_PLAYER_DATA=1 WZM_VM53_STEER_PIN=1 WZM_FORCE_LOOPBACK=1 WZM_CL_RESEND=1 WZM_NULL_ENTITY_GUARD=1
 WZM_ROUTE_LOCAL_HOST_PACKET=1 WZM_OBSERVE_CONNECT_ID=1 WZM_FORCE_OOB_CMD=1 WZM_SEND_GAMESTATE=1)
adb connect PHONE_IP:5555 >/dev/null
(cd ../.. && python3 -m unittest -q test_oob_cmd_force_guard.py test_local_host_packet_route_guard.py test_cl_resend_observer_guard.py 2>&1 | tail -1)
tag=t$(date +%H%M%S)
host(){ (cd ../../.. && env $BASE "$@" analysis/frida_tools/lua_bridge/run_host.sh $tag $SECS mp_mgl_nuketown ${GT:-0x763e0e0566b83935} 2>&1 | grep -E "booted|'bound'|profile|never fired|alive" | cut -c1-120); $PY summarize_host.py $R/$tag.log; print "screenshot: $R/$tag.png"; }
menu(){ mkdir -p $R/boot_$tag; ./boot_offline.sh ${1:-90} $R/boot_$tag >$R/$tag.boot.log 2>&1 &
 for i in {1..60}; do sleep 3; grep -q 'play button ready' $R/$tag.boot.log && break; done; grep booted $R/$tag.boot.log; }
case $1 in
 modes) SECS=25 host WZM_MP_MODE=list ;;
 map) SECS=${3:-120} host WZM_MP_MODE=$2 ;;
 world) SECS=${2:-60} host ;;
 ui) SECS=${2:-90} host WZM_UI_RETRY=1 WZM_LUA_ASSET_CACHE=1 ;;
 mpreal) GT=${GT:-0x303ec68753395310} SECS=${2:-110} host WZM_MODE_REQUEST=11 WZM_UI_RETRY=1 WZM_LUA_ASSET_CACHE=1 WZM_UI_LOOKUP_TRACE=1 ;;
 mp) SECS=${2:-100} host WZM_MP_MODE=${3:-211} WZM_UI_RETRY=1 WZM_LUA_ASSET_CACHE=1 WZM_UI_LOOKUP_TRACE=1 WZM_UI_MISSING_NIL=1 ;;
 scene)
  menu 90; $PY fake_player_data.py | tail -1 | cut -c1-120
  sed "s/^local SCENE=.*/local SCENE=\"${2:-character_faction_select_l}\"/" scene_try.lua > $R/$tag.scene.lua
  $PY lua_exec.py $R/$tag.scene.lua 10 | tail -1 | cut -c1-400
  sleep 6; adb -s PHONE_IP:5555 exec-out screencap -p > $R/$tag.png; print "screenshot: $R/$tag.png" ;;
 hash)
  menu 90; $PY hash_scan.py 56794f44b636e9f1 6ac1fc715aaefeda ;;
 *) sed -n 2,8p $0 ;;
esac
