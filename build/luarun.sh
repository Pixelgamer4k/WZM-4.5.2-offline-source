#!/bin/zsh
# Run a Lua file inside the running game's LUI state (dev console in the r17+ agent). Root needed.
# usage: luarun.sh file.lua [timeout_s]
set -eu
D=${WZM_DEV:-PHONE_IP:5555}; P=com.activision.callofduty.warzone; F=/data/user/0/$P/files
T=${2:-40}
N=wzm$RANDOM$RANDOM
{ cat "$1" | sed "s/^return /return '@$N|' .. /"; } > /tmp/wzm_lua_in.lua
adb -s $D push /tmp/wzm_lua_in.lua /data/local/tmp/wzm_lua_in.lua >/dev/null
adb -s $D shell "su -c 'rm -f $F/wzm_lua_out.txt; cp /data/local/tmp/wzm_lua_in.lua $F/wzm_lua_in.lua.tmp; chown \$(stat -c %u:%g $F) $F/wzm_lua_in.lua.tmp; chmod 600 $F/wzm_lua_in.lua.tmp; restorecon $F/wzm_lua_in.lua.tmp; mv $F/wzm_lua_in.lua.tmp $F/wzm_lua_in.lua'"
for i in $(seq 1 $T); do
  R=$(adb -s $D shell "su -c 'cat $F/wzm_lua_out.txt 2>/dev/null'" || true)
  if print -r -- "$R" | grep -q "@$N"; then print -r -- "$R" | sed "s/@$N|//"; adb -s $D shell "su -c 'echo -- done > $F/wzm_lua_in.lua'"; exit 0; fi
  sleep 1
done
echo "TIMEOUT (no result in ${T}s)"; exit 1
