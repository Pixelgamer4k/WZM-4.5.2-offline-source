# How every feature is done

Each section: the problem, the mechanism, and the files/addresses. Addresses are offsets into `libgame.so`
(build 22729281). The full list is docs/05.

---

## A. Boot offline, past the online login

**Problem.** The servers are gone. The pre-login WebView never gets a response, and the engine's "fence groups" wait
forever on online-only fences, so the main menu never builds. The online pre-login page also shows "these servers are
permanently offline".

**Mechanism.**
1. **Bootstrap page** (`build/offline_bootstrap.html`, installed as `assets/bootstrap/index.html`). The engine opens
   it in a WebView and exposes `window.jsBridge`. The page posts `sysReady`, then `passPreloginFence` (3 s), then
   `closeWebView` (6 s). The engine proceeds as if pre-login succeeded.
2. **Fence skip in Lua** (`bridge/skip_online_fences.lua`, run by `agent/native_boot.js`). On a real UI Lua frame it
   walks the main menu's `FenceGroup` and marks every online fence (onlineServices, gamerProfile, patch, ffotd,
   onlinePlayerstats, mainOnlineData, platformServices, playlists, exchange, churnReward, onlineServiceSubscription,
   mpOnlineData, fnf, fenceSpinner, ftue, motd, dailyLineup, uxpcloudsyncinit) as **passed**: it replaces the fence
   object's `State` method with one returning 0 and sets `_state = 0`. It also neutralises the FTUE (tutorial) layer
   and forces the main-menu PLAY button's status model to "Play" (value 1), because nothing sets it correctly offline.
   It must run again after every LUI rebuild.
3. **Native UI frame hook** (`agent/native_boot.js`). Exactly one hook on the UI Lua frame function
   (`0x337c1c0`), installed ≥15 s after the agent loads, running the skip at most every tenth frame until the menu is
   real. Boot stages are logged.

**The "you appear to be offline" box** (separate from the above) is drawn by `assets/bootstrap/offline.js` whenever
`navigator.onLine` is false (Wi-Fi + data both off). `build_all.py` disables that box. *Note (open issue):* with all
networking off the engine still stalls on the logo before the agent even loads — see docs/07.

**Logo-stall watchdog** (`agent/native_boot.js` / `entry.js`). Boots stall at the Activision logo often. If no UI Lua
frame arrives for 35 s, the process is relaunched, up to 4 times (`files/wzm_stall_count`).

---

## B. Accept the re-signed APK

**Problem.** The APK is re-signed with your key. The game asks PackageManager for its own signer and exits if it isn't
the Activision publisher certificate.

**Mechanism** (`agent/signature_spoof.js`). The Gadget loads before `libgame.so`. The agent hooks the Java
PackageManager paths that return signing info, and for **this package only** returns the original publisher
certificate (the exact DER is embedded). Other packages are untouched.

---

## C. Unlock everything

**Problem.** Guns/operators/skins/camos/attachments are gated by ownership checks and by progression levels.

**Mechanism** (`bridge/offline_unlocks.lua`, `offline_unlocks_ext.lua`, `offline_unlocks_level.lua`; driven by
`pipeline.js` `unlockAll`).
- The game's ownership predicate keyed by `xhash #x013d8bd2b211db6cc` is wrapped to report ownership for every item
  type (ATTACHMENT, CAMO, CHARM, CONTRAIL, EMBLEM, EMOTE, EQUIPMENT, GESTURES, OPERATOR, OPERATOR_SKIN, LOOT, …).
- Level-gated items use `PROGRESSION.#x33568d3533d63f69(controller, itemID) -> true`.
- Must re-run after every LUI rebuild (the keeper does this).

**Gear Up needs the weapon catalog.** The editor's `WEAPON_DEF` fence must read 4. `bridge/frontend_weapon_catalog.py`
(ported to `unlock/weapon_catalog.js`) registers 657 resident `WeaponCompleteDef` assets through the game's own
callback (`libgame+0x28fe554`), so the fence passes naturally. **This catalog breaks the next match load** (DEV ERROR
0x1BEE3C2D) and cannot be undone in-process, which is why PLAY after Gear Up restarts the game.

---

## D. Host a match with real bots

**Problem.** Offline there is no server. The engine's server start runs through a protected VM, and the local client
is rejected.

**Mechanism** (`bridge/host_spawn.py` → host JS inside the agent; `pipeline.js`).
- **Protection VM steer** (`WZM_VM53_STEER_PIN`): the protected stubs are steered into the real constructors so
  `SV_SpawnServer` (`0x3ce8cfc`) completes and a server thread runs `SV_Frame` (`0x3cf10e0`).
- **Forced loopback** (`WZM_FORCE_LOOPBACK`): sets a flag so the client channel state goes 1→5 and the client reaches
  the world without `Com_Error`.
- **Match start** is triggered from the session-manager tick the host replaces (`0x1617e74`): set the map dvar, switch
  the mode table to MP (forced mode ≥200), set the game type, run the world teardown, call host start `0x1621ab0`.
- **Bots:**
  - `bridge/party_bot_inject.js`: 2 placeholder "test clients" (stand still, don't shoot).
  - `bridge/native_ai_both_sides.js`: the real AI creator, enemies + allies (marker-2 bots).
  - `bridge/native_ai_veteran_guard.js`: sets difficulty (Recruit…Veteran).
- **Class** is sent through LUI (`class_select:<index>`), 22 s after the client connects.

Maps and game-type hashes are in `pipeline.js` (`MAPS`, `MODES`). Nuketown/Crash TDM are the tested combination.

---

## E. Save and restore loadouts

**Mechanism** (`bridge/dump_loadouts.lua`, `seed_all_loadouts.lua`; `pipeline.js`).
- Loadouts live in `PLAYER_DATA[#x08b73907b55c4d71](0, group).loadouts[i]` across 4 groups (WZRanked, Ranked,
  Private, WZPrivate).
- `dump_loadouts.lua` walks each field into `path<TAB>type<TAB>value` lines (careful: `pairs()` over DDL nodes never
  ends — stop at the first repeated key, skip `__pad`, walk arrays by `#len`). Saved to `files/wzm_loadouts.tsv`.
- Restore sets each node with the game's own `:set()`.
- Saved every 30 s (keeper) and before every PLAY.

---

## F. Operator + skin, carried into matches

**Mechanism** (`pipeline.js` `saveOperator`/`restoreOperator`; `files/wzm_operator.tsv`).
- Per group: `customizationSetup.selectedOperatorIndex`, `operators[0..1]` (operator skin refs, type `xhash`), and
  `operatorCustomization[opRef]` fields `skin`, `chroma`, `execution`, `taunt`, `intro`.
- An `xhash` cannot be built from text in Lua. Two ways are used:
  - `operators[i]:set('#x<hex>')` accepts the hex text directly.
  - `skin:set` rejects text, so the real skin value is taken from the operator's own skin list:
    `OPERATOR[#x072145c734039267f](opX)` field `#x0a44bec41ef81a271`, each entry's `#x03f1a2d18de6ad138`.
- Auto-save is held until this process restored the saved pick cleanly, so a fresh boot's default can't overwrite it.

---

## G. 3D Gear Up (operator / gun previews, 3D menu backdrop)

**Problem.** The 3D in the menus is drawn by a small local "Local FrontEnd" server (`mp_frontend_mgl`). Offline the
engine never starts it (it waits on the ONLINE fence), so every 3D area is black.

**Mechanism** (`pipeline.js` `startFrontendRoom`).
- The frontend manager `0x3aae118` waits in state 3 for fences ONLINE(13) and NETWORKING(2), checked by `0x36ae29c`
  from return sites `0x3aae2a0`/`0x3aae2b0`. The agent passes **only those two checks**.
- When the room's server starts (`0x3cc990c`) it turns on the host's protection bypass, marked `wzmFrontend` so no
  match-only steps run.
- After the room's UI rebuild, the agent re-applies the fence skip (clearing the stale `_WZM` marker and giving the
  3D squad models a party size of 0), then fixes the PLAY button.
- **It only starts on the first Gear Up tap of a session** (owner choice). Going from the room straight into a match
  crashes (freed room memory is still drawn: fault `0x4d597a0`), so PLAY after the room restarts the game.

---

## H. Third-person camera

**Mechanism** (`agent/mac_port/camera3p.js`). The engine's own 3P predicate (`0x1f6e840`) is forced true **for the
local player only**; the local player state is read from the camera callsite (`0x2326aac`, register x24). Hooks exist
only while 3P is on. Exposed as a "Camera: First/Third person" row in the ball; switches live in a match; saved in prefs.

---

## I. Live graphics panel

**Mechanism** (`agent/mac_port/gfx_live.js`).
- The dvar table is at `0x54bd7b8` (entry stride 0x58; value at +0x28 and +0x38; type byte at +0x15; reset at +0x48).
  Dvars are found by walking the table and matching the 64-bit name hash (FNV-1a, see docs/05).
- The resolution-preset clamp at `0x2ef61f8` is patched to `ret`, so the chosen preset isn't forced back every frame.
- The fixed scene (render) size is set via the sizing call `0x2eaf78c` (dynamic level forced to 0).
- Reflection quality is an int at `0x835ed9c`.
- Options in the panel: resolution 540p–Native, dynamic resolution, render preset, fps cap, anti-aliasing (None/SMAA/
  SGSR) + SMAA quality, temporal, upscaler/sharpen (CAS), textures, detail, filtering, reflections, shadows, AO/GI,
  motion blur, colour filter, advanced. Each row says whether it applies instantly or at the next match.
- **Only safe writes are exposed.** Texture pool sizes are fixed at renderer init (raising them at boot crashes);
  several quality enums hitch for ~300 ms when changed mid-match; lighting/GI upgrades crashed matches — all opt-in or
  excluded. See docs/07.

---

## J. In-game UI (the floating ball + OPTIONS panel)

**Mechanism** (`agent/entry.js`, using `frida-java-bridge`). The agent builds Android views and adds them to the game
Activity's `decorView` — no overlay permission, no second app. The ball fades to faint when idle (one tap to restore,
another to open). The panel has MATCH and GRAPHICS tabs, PLAY (or RESTART & PLAY), Export Logs (shares the agent log
via the Android share sheet), and Reset Tab.

---

## K. Running the computer-era scripts inside the APK

All the original ADB/root scripts (`bridge/`) run unchanged in-process through `agent/mac_port/stage.js`, which gives
each one its own `globalThis`, `send()`, `rpc.exports` and exception slot, and an `unload()`. `pipeline.js` is the
port of the Python drivers and reacts to the same native messages in the same order. Hot paths are native CModule code
in the host (a JS hook per frame cost ~15% CPU). On phones with no free memory near `libgame.so`, hooks go through
relays in code caves (`nearhook.js`, `caves.js`).
