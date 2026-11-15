#!/bin/zsh
# block_after_enter.sh <secs> <out.jsonl>: after the newest run log logs clientEnterWorld, attach java_block_close.js.
cd ${0:A:h}; D=../../runtime/match_entry_20261102; old=$(ls -t $D/t*.log | head -1)
until L=$(ls -t $D/t*.log | head -1); [ "$L" != "$old" ] && grep -q clientEnterWorld $L 2>/dev/null; do sleep 1; done
../../frida_venv/bin/python3 java_watch.py java_block_close.js $1 $2
