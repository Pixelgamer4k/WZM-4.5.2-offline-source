# Architecture

## The pieces

```
Phone (no root needed)
└─ Warzone Mobile 4.5.2 process  (com.activision.callofduty.warzone)
   ├─ Java: GameApplication ──(25 s later, main process only)──► System.loadLibrary("gadget")
   ├─ libgadget.so           Frida Gadget 17, "script" mode, runs libgadget.script.so in-process
   │   └─ agent (agent/entry.js, bundled)
   │       ├─ loader.js            prefers files/wzm_agent_override.js (hot update) over the embedded copy
   │       ├─ signature_spoof.js   PackageManager returns the original publisher certificate to the game
   │       ├─ native_boot.js       one hook on the UI Lua frame; runs skip_online_fences.lua until the main menu is real
   │       ├─ mac_port/pipeline.js "session": profile, unlocks, keeper, loadouts, operator, 3D room, PLAY / restart
   │       │    └─ mac_port/stage.js  runs each original bridge script as if Frida had loaded it separately
   │       ├─ mac_port/gfx_live.js live graphics (dvar writes, resolution sizing hook)
   │       ├─ mac_port/camera3p.js third-person camera
   │       └─ UI: floating "WZ" ball + OPTIONS panel added to the game Activity's window (Java via frida-java-bridge)
   ├─ libgame.so (unchanged)  IW engine: LUI (LuaJIT UI), DB/fastfiles, client, server, bots, renderer (Vulkan)
   └─ files/ (private)        wzm_prefs.json, wzm_loadouts.tsv, wzm_operator.tsv, wzm_pending_match.json, logs
External storage: Android/data/<pkg>/files  — the 13 GB game data (zone/*.ff, xpak_cache, shard_cache …)
```

## Boot sequence (what happens after tapping the icon)

1. Java starts the game normally. The splash WebView loads `assets/bootstrap/splash.html` (the loading picture).
2. The engine opens the pre-login WebView with `assets/bootstrap/index.html`. Our replacement page calls
   `jsBridge.post('sysReady')`, then `passPreloginFence` (3 s), then `closeWebView` (6 s). The engine continues as if
   the online pre-login had succeeded.
3. At 25 s the patched `GameApplication` loads the Gadget. It runs the agent.
4. `native_boot.js` waits ≥15 s, then attaches one hook to the UI Lua frame (`libgame+0x337c1c0`).
   - On UI frames (at most every tenth) it runs `skip_online_fences.lua` until the real main menu exists.
   - The Lua marks every online-only fence (onlineServices, gamerProfile, patch, ffotd, playlists, …) as passed, and
     forces the main-menu PLAY button into its "Play" state.
   - Stages: `WAIT_LUI_FRAME` → `FENCE_PENDING` → `WAIT_MAINMENU_PLAY_BUTTON` → `MAINMENU_FENCE_READY`.
   - Watchdog: no UI frame for 35 s means a "logo stall"; the game is relaunched, at most 4 times in a row.
5. The main menu is up, and `pipeline.prepareMenu()` runs:
   - binds a fake local player profile (`fake_player_data`), so stats/progression read as "ready";
   - restores the saved operator/skin and loadouts;
   - if `files/wzm_pending_match.json` is recent: starts that match at once (the restart path, below);
   - otherwise loads and arms the host (no match yet). Loading it before the unlocks keeps Gear Up from closing the
     game. Then it unlocks everything and starts the Gear Up watcher and the keeper.
6. The ball appears about 20 s after the menu.

## Starting a match (PLAY in the ball)

- **Fresh session (no Gear Up opened, no match played yet).** The host's `go(map, gametype, enemies)` arms a request.
  1. On the next session-manager tick (the host replaces `libgame+0x1617e74`), it sets the map dvar, switches the mode
     table to MP, sets the game type, and turns on the protection-bypass flow.
  2. It runs the world teardown helpers and calls the game's own host start (`0x1621ab0` → `SV_SpawnServer`).
  3. The local client connects over a forced loopback.
  4. Once the player is in the world, `party_bot_inject.js` adds 2 placeholder test clients.
     `native_ai_both_sides.js` creates the real AI (enemies + allies). `native_ai_veteran_guard.js` sets their difficulty.
  5. The class is picked automatically (`class_select:<n>` sent through LUI, 22 s after connect).
- **After Gear Up, after a match, or after the 3D room.**
  1. PLAY saves loadouts and operator.
  2. It writes `files/wzm_pending_match.json` and restarts the process (`Intent.makeRestartActivityTask` + `Runtime.exit`).
  3. The new process boots and starts the match by itself (step 5 above).
  - Reason: the weapon catalog, the second in-process match, and the room→match switch each break or kill the next match.

## Leaving a match

"Pause → Main Menu" disconnects. The snapshot timer sees client state drop below 5.
1. `menu_return_watch` (`watch.js`) re-runs the online-fence skip on the new front-end Lua state.
2. 12 s later the unlocks are applied again (new LUI state) and the keeper restarts.

## Keeper (every 10 s, while in the menu)

- `check_unlock_state.lua`: if the unlock wrappers are gone, LUI was rebuilt. Then it:
  1. clears the stale skip markers;
  2. fixes the party-size data source for the 3D squad models;
  3. re-runs the fence skip;
  4. re-runs all unlocks;
  5. runs a second skip pass to fix the PLAY button.
- Every 30 s: saves loadouts (`dump_loadouts.lua` → `wzm_loadouts.tsv`) and the operator (`wzm_operator.tsv`). The
  operator is saved only after this process has restored it cleanly, so a fresh boot can't overwrite your pick with
  the default.

## How the original scripts run inside the APK

The work was first done from a computer (Python + Frida over ADB, root). Those scripts are in `bridge/`.
`agent/mac_port/generate_mac_sources.py` embeds them **unchanged** into `mac_sources.js`. `stage.js` runs each one as
if it were its own Frida script:
- its own `globalThis`, `send()`, `rpc.exports` and exception-handler slot;
- `unload()` removes its hooks.

`pipeline.js` is the port of the Python drivers (`menu.sh`, `unlock_all_menu.sh`, `menu_keeper.sh`,
`match_from_menu.sh`, `bot_ready_watch.py`, `both_sides_bots.py`). It reacts to the same messages in the same order.

`nearhook.js` + `caves.js`: on some phones no executable memory is free within ±128 MB of the 222 MB `libgame.so`, so
Frida cannot place its usual branch to a trampoline. Hooks then go through "relays" written into zero padding inside
libgame's own code segment (code caves found by `generate_caves.py`).

## Settings and persistence (all in `/data/user/0/<pkg>/files`, private to the game)

| File | Content |
|---|---|
| `wzm_prefs.json` | ball settings: map, mode, difficulty, class, bots, third person, all graphics options |
| `wzm_loadouts.tsv` (+ `.bak`) | every loadout field, `path<TAB>type<TAB>value` |
| `wzm_operator.tsv` | per loadout group: selected operator index, `operators[0..1]`, and per-operator skin/chroma/execution/taunt/intro |
| `wzm_pending_match.json` | the match to start after a restart (`{req, at}`, valid 15 min) |
| `wzm_stall_count` | consecutive logo-stall restarts |
| `wzm_offline.log` | agent log (also logcat tag `WZM`) |
| `wzm_agent_override.js` | optional hot-update agent (dev only; delete for release) |
| `wzm_no_frontend_room` | optional: disables the 3D Gear Up room |
