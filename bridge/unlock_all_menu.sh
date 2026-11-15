#!/bin/zsh
# Unlock all guns, operators, skins and camos in the MAIN MENU (session-only, memory-only).
# Use AFTER leaving a match to the main menu (play_with_bots.sh / play_mp.sh, then Pause > Main Menu).
# A menu-only boot is not enough: there the game closes itself when the editor opens.
# Steps: preview crash guard (stays attached), 657-gun catalog + profile + hub + PROGRESSION unlocks,
# client fence, 5 starter loadouts, unlock query in OPERATOR/OPERATOR_SKIN/LOOT/ATTACHMENT, open Edit Loadouts.
set -eu
cd "${0:A:h}"
PY=../../frida_venv/bin/python3
OUT=../../runtime/unlock_all_$(date +%Y%m%d_%H%M%S); mkdir -p "$OUT"
nohup "$PY" java_watch.py frontend_preview_guard.js ${WZM_GUARD_SECS:-7200} "$OUT/guard.jsonl" > "$OUT/guard.out" 2>&1 &
# previewGuardBadOpcode means an earlier run of this script already patched the site (guard still active).
sleep 5; grep -qE "previewGuardInstalled|previewGuardBadOpcode" "$OUT/guard.jsonl" || { print "preview guard failed: $(cat $OUT/guard.out $OUT/guard.jsonl)"; exit 1; }
zsh prepare_loadout_frontend.sh > "$OUT/prepare.txt"
"$PY" lua_exec.py offline_client_fence.lua 10 > "$OUT/fence.txt" 2>&1
# WZM_SKIP_SEED=1 keeps loadouts the player already edited this session.
if [[ ${WZM_SKIP_SEED:-0} != 1 ]]; then "$PY" lua_exec.py seed_all_loadouts.lua 15 > "$OUT/seed.txt" 2>&1; fi
# Saved Gear Up loadouts (~/.wzm_loadouts.tsv) go back into every loadout set.
"$PY" restore_loadouts.py > "$OUT/restore.txt" 2>&1
"$PY" lua_exec.py offline_unlocks_ext.lua 15 > "$OUT/unlocks_ext.txt" 2>&1
# Level-gated items (tacticals, lethals, perks, streaks): PROGRESSION.33568d3533d63f69 -> true.
"$PY" lua_exec.py offline_unlocks_level.lua 15 > "$OUT/unlocks_level.txt" 2>&1
# WZM_NO_OPEN=1 (used by menu_keeper.sh) re-applies unlocks without opening Gear Up.
if [[ ${WZM_NO_OPEN:-0} != 1 ]]; then "$PY" lua_exec.py open_gear_up.lua 20 > "$OUT/open.txt" 2>&1; fi
print "Edit Loadouts open; everything unlocked. Receipts: $OUT"
tail -1 "$OUT/unlocks_ext.txt" | cut -c1-200
