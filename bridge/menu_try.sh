#!/bin/zsh
# usage: menu_try.sh <lua chunk> <shot dir>: keep the watcher attached while running one chunk.
cd "${0:A:h}"
(sleep 9; ../../frida_venv/bin/python3 lua_exec.py $1 8 </dev/null 2>&1 | tail -1 | sed "s/.*'result': //" | cut -c1-900) &
../../frida_venv/bin/python3 watch.py 20 "$2" </dev/null 2>&1 | grep -E 'lua_error|zone_lookup|"chunk"|Traceback' | sed 's/\\n/\n/g;s/\\t/  /g' | cut -c1-150 | head -22
wait
../../frida_venv/bin/python3 lua_exec.py p13_status.lua 8 </dev/null 2>&1 | tail -1 | sed 's/\\n/\n/g' | tail -5 | cut -c1-110
