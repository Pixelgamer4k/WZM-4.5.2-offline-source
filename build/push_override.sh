#!/bin/zsh
# Dev hot update: compile the v9 agent and install it as the game's private override file.
set -eu
A="$(cd "$(dirname "$0")/../agent" && pwd)"
D=${WZM_DEV:-PHONE_IP:5555}; P=com.activision.callofduty.warzone; F=/data/user/0/$P/files
cd $A
frida-compile entry.js -B iife -S -o /tmp/wzm_override.js
node --check /tmp/wzm_override.js
adb -s $D push /tmp/wzm_override.js /data/local/tmp/wzm_override.js >/dev/null
adb -s $D shell "su -c 'cp /data/local/tmp/wzm_override.js $F/wzm_agent_override.js; chown \$(stat -c %u:%g $F) $F/wzm_agent_override.js; chmod 600 $F/wzm_agent_override.js; restorecon $F/wzm_agent_override.js; ls -laZ $F/wzm_agent_override.js'"
