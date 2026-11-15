#!/bin/zsh
# Boot to the offline MAIN MENU (no match) with everything unlocked and your saved Gear Up loadouts
# restored, then keep it that way (auto-recovers UI resets, auto-saves loadout edits every 30 s).
# Start a match afterwards from the launcher with "... from menu" so the game is not restarted.
set -u
cd "${0:A:h}"
R=../../runtime/match_entry_20261102
for p in play_mp.sh play_offline.sh play_with_bots run_host.sh host_spawn bot_ready_watch menu_return_watch both_sides_bots menu_keeper.sh; do pkill -f $p; done
WZM_MENU_ONLY=1 WZM_MENU_RETURN=0 WZM_BOTS=1 WZM_ENEMY_AI=4 WZM_ZONE_INJECT=inject_sierra_bc3.json WZM_SKIP_ENTCHK=1 WZM_PACK_INSTALLED=verdansk_pack_files.json WZM_BOOT_TRIES=${WZM_BOOT_TRIES:-6} WZM_BOOT_WAIT=25 WZM_BOOT_PROBE_WAIT=30 WZM_CLASS=pick \
  nohup zsh ./play_offline.sh ${1:-14400} > $R/last_menu.out 2>&1 &
sleep 4; T=$(head -1 $R/last_menu.out | awk '{print $2}' | tr -d ,)
print "Booting to the main menu (session $T)…"
until grep -qE 'booted on|giving' $R/$T.boot.log 2>/dev/null; do sleep 2; done
grep -E 'booted on|giving' $R/$T.boot.log | tail -1
grep -q 'giving' $R/$T.boot.log && exit 1
until grep -q menuOnlyArmed $R/$T.log 2>/dev/null; do sleep 2; done
sleep 4
WZM_SKIP_SEED=${WZM_SKIP_SEED:-0} WZM_NO_OPEN=1 zsh ./unlock_all_menu.sh | tail -1
print "Main menu ready: everything unlocked, saved loadouts restored. Keeper running (Ctrl-C or 'stop' ends it)."
exec zsh ./menu_keeper.sh ${1:-14400}
