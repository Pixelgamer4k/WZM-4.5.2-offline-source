#!/bin/zsh
# Apply proven frontend preparation to an ALREADY BOOTED menu. No restart or match launch.
# Experimental: menu render and match persistence require separate verification.
set -eu
cd "${0:A:h}"
PY=../../frida_venv/bin/python3
OUT=../../runtime/loadout_continuation_20261105/prepared_$(date +%Y%m%d_%H%M%S)
mkdir -p "$OUT"
"$PY" boot_ready.py > "$OUT/ready.txt"
if [[ "$(cat "$OUT/ready.txt")" == 0x0 ]]; then print 'LUI not ready';exit 1;fi
"$PY" frontend_weapon_catalog.py --apply > "$OUT/catalog.jsonl"
"$PY" fake_player_data.py > "$OUT/profile.txt"
"$PY" restore_hub_binary.py > "$OUT/hub.txt"
"$PY" lua_exec.py offline_unlocks.lua 10 > "$OUT/unlocks.txt"
print "Prepared current menu; receipts: $OUT"
