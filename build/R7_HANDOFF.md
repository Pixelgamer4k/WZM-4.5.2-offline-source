# WZM 4.5.2 standalone — r7 checkpoint · 11 Nov 2026 ~14:45 IST

## State in one paragraph
r7 is installed on the OnePlus (inherit update of the arm64 split only, data intact 13 GB). The APK now boots to the menu,
shows a new floating ball + redesigned panel, auto-unlocks everything in-process, and **a full Nuketown TDM match with
5 Veteran AI bots was played from the APK alone** (no computer) — *when the menu unlock steps were skipped*.
Open blocker: after the menu unlock steps run, Play dies during map load with `DEV ERROR 0x1BEE3C2D`
(engine pool exhausted, `libgame+0x3e4396c`, called from `0x1deb3d8`). The Mac menu-only flow hit the same family of
failure (`play_*.log` with `menuOnlyArmed`: fault `libgame+1de93b4`, never entered the world); only cold-boot `play_mp.sh` worked.

## Where things are
- Agent source (v9): `standalone_combined_v9_20261111/agent/`
  - `entry.js` — boot (unchanged native_boot fence), new UI (ball + panel), file/logcat logging (tag `WZM`,
    file `/data/user/0/com.activision.callofduty.warzone/files/wzm_offline.log`), crash witness, prefs.
  - `mac_port/generate_mac_sources.py` → `mac_port/mac_sources.js`: runs the REAL `host_spawn.py` with the
    `play_mp.sh` environment against a mock `frida` module and captures the exact host source; embeds the other Mac
    scripts verbatim (party_bot_inject, native_ai_both_sides, veteran guard, lua_exec, fake_player_data, unlock-all set).
    Class preset is `__WZM_CLASS_INDEX__` substituted at Play.
  - `mac_port/stage.js` — runs each Mac script as if it were its own Frida script: own globalThis/send/rpc/
    exception handler; `unload()` detaches its hooks/timers. **Pins the whole scope** (closure with direct eval):
    without it the GC freed host CModule code → the r6/r7 `WZM_Main` SIGSEGV at an unmapped pc. That was the r6 Play crash.
  - `mac_port/pipeline.js` — Mac flow replay: prepareMenu (fake_player_data + restore loadouts + unlock_all) →
    keeper (10 s, re-unlock on UI reset, saves loadouts to files/wzm_loadouts.tsv every 30 s) → play():
    save loadouts, client-fence restore, unlock overrides off, weapon-registry count restore, fake_player_data,
    restore loadouts, load host (class auto-pick), `go(map,gametype,enemies)`, then spawn(`matchProbe spec=false`) →
    party inject → both-sides AI → unload → veteran guard. Fatal-message witness hook at `libgame+0x12a12f4`.
  - `loader.js` — gadget entry: runs embedded IIFE agent, or `files/wzm_agent_override.js` if present (dev hot update).
- Build: `clean_rebuild_20261111/build_r7.py` (source r6 set → `signed_five_split_r7`). Dev push: `push_override.sh`
  (compiles and installs the override file; then force-stop + launch). Remove the override file before shipping.
- r6 sources/APKs untouched (`standalone_combined_v8_20261110`, `signed_five_split_r6_strings`).

## Proven on device (r7 + override)
- Boot → MAINMENU_FENCE_READY → UI attached; unlock-all: 657 weapons registered, OPERATOR/LOOT/ATTACHMENT/OPERATOR_SKIN
  + level items unlocked, 5 classes seeded (`boot6`, `boot9..12` logs).
- With unlock skipped (test flag file `files/wzm_test_no_auto_unlock`): Play → clientEnterWorld → spec=false →
  party → 5 marker-2 AI → Veteran guard; player in first person with gun; bots visible (`r7_match3.png`).

## Findings
1. `WZM_CLASS=pick` (menu.sh) leaves the player spectating forever → enemies forfeit. Use `class_select:N@22000`.
2. Frontend weapon registry (count `+0x6cb1ab0`, entries `+0x6cb1ac0`, entry 0 empty after catalog) is walked at match
   load (`0x1de939c`); restoring count to 0 removed the `1de93b4` null fault.
3. Still failing after (2)+client-fence restore+unlock overrides off: DEV ERROR 0x1BEE3C2D (pool alloc `0x3e43680`).
   Remaining suspects: seed_all_loadouts, hub restore, weapon catalog side effects beyond the count, preview guard.
4. Logo stalls are frequent (~50% of launches); restart immediately (owner rule).

## Next
Bisect suspects in (3); if not fixable quickly, make Play relaunch the game process into a clean menu and start the
match there (cold-boot equivalent), keeping unlock/Gear Up for menu sessions. Then: rebuild a release APK with no
override file, operator change / emblem dev error, 3D preview (later per owner).

## Update 15:02 — r8 installed and verified end to end (embedded agent, no override file)
- Cause of the post-unlock crash: the frontend weapon catalog step (`frontend_weapon_catalog`, 657 registrations at
  `libgame+0x28fe554`). Skipping only that step → match OK. It cannot be undone in-process (pool alloc `0x3e43680`,
  DEV ERROR 0x1BEE3C2D), so **Play after unlock saves loadouts, writes `files/wzm_pending_match.json`, relaunches the
  game (Intent.makeRestartActivityTask + Runtime.exit) and the fresh process starts the match by itself** (no unlock
  steps in that process = the Mac cold-boot `play_mp.sh` path).
- Host = exact `play_mp.sh` source with `class_select:<CLASS-1>@22000` (panel CLASS selector, default 1).
- Logo-stall watchdog: no LUI frame 35 s after the hook → automatic relaunch, max 4 in a row (`files/wzm_stall_count`).
  Implemented, not yet exercised by a real stall on r8.
- AI creator retry (3×) on `botInjectError`.
- r8 run (`r8_e2e`): boot → unlock all → Play → relaunch → Nuketown → spawn class 1 → party → 5 Veteran AI → guard;
  bots kill the player (real combat). Set: `signed_five_split_r8` (arm64 split sha 57011182…), built by
  `build_r7.py --output signed_five_split_r8`. Installed on the OnePlus via inherit session; data 13 GB intact.
- Not yet verified: Gear Up editing → save (`dump_loadouts`) → restore in the match; other maps/modes; return to menu
  after a match; operator change; emblem dev error; 3D preview.

## Update 15:55 — r9 built (not installed yet; phone currently runs r8 + override = same code)
Owner requirements (11 Nov): no restarts ever; unlocks always automatic on every boot and after every match;
no UNLOCK/GEAR UP buttons; next match straight from the main menu.
- Weapon catalog step is NEVER run (it breaks the next match: DEV ERROR 0x1BEE3C2D). Relaunch path is dead code.
- Host loaded at the menu before unlocks (menu.sh order) — keeps Gear Up from closing the game.
- Fresh-boot Gear Up weapon slot → runaway memory (~12 GB, OxygenOS Athena kill). After one match it works
  (weapon list, blueprints, equip). Mac notes said the same. Open item: fix for fresh boot.
- Return to menu: host snap clc0 >=7 → <5 ⇒ watch.js + skip_online_fences.lua (menu_return_watch.py port) ⇒ unlocks
  again (no black menu). Verified twice.
- Second match from the menu without restart: host reused; lui_send.js got a generated `luiSendReset(cls)` (per-match
  class pick); bot stages are retired, never unloaded (they patch the server veneer; unloading → SIGSEGV in match 2).
- lua_exec.js L->top restore made stack-relative (LuaJIT +0x28 top, +0x30 maxstack, +0x38 stack) — big dumps grew the
  stack and the raw pointer dangled (VM crash at libgame+44947cc).
- Fake profile runs once per process (re-running over restored loadouts → libeevsdgz traps → window removed).
- Loadouts: auto-saved every 30 s to files/wzm_loadouts.tsv, restored at boot and before each match. Verified AK-74
  PAYBACK + 9MM Daemon in match.
- Pending verification: match 2 after the luiSendReset build (owner test was interrupted by a phone call),
  Gear Up without the catalog after a match (weapon list may be empty — must check).
- r9 set: signed_five_split_r9 (arm64 sha 29c40ef4…). Install like r8 (inherit session), then delete
  files/wzm_agent_override.js.

## Update 16:08 — r9 INSTALLED (owner chose option 1)
- Owner decision: first match of a game session starts in place; every later match uses the automatic clean restart
  (save loadouts → files/wzm_pending_match.json → relaunch → match starts by itself). Panel explains this.
- Second match in the same process: loads and spawns, then the window is removed ~8 s later (anti-tamper
  library). Owner chose not to pursue that path; leave it.
- r9 arm64 split sha bb091836…; override and test files removed from the phone; loadouts kept. Boot + panel verified.

## Update 16:15 — r10 INSTALLED (current)
- GEAR UP tile needs WEAPON_DEF → weapon catalog runs on every menu (boot, after match, keeper). Therefore EVERY Play
  uses the automatic clean restart (pending match file → relaunch → match starts itself). Panel text says so.
- Verified on device: fresh-boot GEAR UP opens, Weapon Select lists guns, memory flat ~2.4 GB (earlier 12 GB runaway
  no longer reproduces after the once-per-process fake profile + stack-safe lua_exec fixes). Play → restart → logo
  stall → watchdog auto-restart → match → spawn → 2 Veteran bots. arm64 sha d3528562…; override removed.
- Open: operator change, emblem developer error, 3D preview (owner: later).

## Update 16:26 — Graphics tab (r11 built, NOT installed; phone runs r10 + override with the same code)
- Panel tabs MATCH / GRAPHICS. Graphics prefs in wzm_prefs.json `gfx`, passed per match as stage global WZM_GFX_ENV
  (pipeline.gfxEnv). Generator now: user env wins over {pct:75}; AA settable (E.aa); fixed-640 hook takes
  E.sceneH (540/640/720/800/'native') and E.dynamic (skip forcing level 0); master switch E.off skips gfx_apply +
  fixed hook entirely.
- Options: resolution 540p/640p/720p/800p/Native, frame cap, AA None/SMAA/SGSR, CAS sharpening, textures
  default/High/Very High/Ultra, reflections Off/Low/Medium/High (experimental), dynamic resolution, lighting
  (experimental, crashed twice before), motion blur.
- Verified: boot log shows env built from prefs. NOT yet verified on device: tab rendering, each option's in-match
  effect (owner testing).

## Update 16:56 — r12 INSTALLED (current)
- Options-style panel (MATCH / GRAPHICS, sub-tabs DISPLAY/QUALITY/EFFECTS/ADVANCED, description pane, footer).
- Live graphics: mac_port/gfx_live.js owns all graphics (host gfx code always off via WZM_GFX_ENV.off). Settings
  apply instantly (menu + match) except texture/detail/reflections/shadows/AO (next map load). Verdansk forces
  Game-default textures. Lighting "light" combo removed (crashed at libgame+0x2d2ca44).
- GEAR UP on demand: boot unlock skips the weapon catalog; a Lua wrapper counts Fences(…,'WEAPON_DEF') queries; a
  burst after ≥3 quiet polls = tile tap → catalog + open_gear_up (≈10 s). Then next PLAY restarts. Without Gear Up,
  first PLAY is instant (verified: Nuketown loaded 13 s, 5 Veteran bots). If the menu polls WEAPON_DEF continuously,
  it falls back to registering the catalog immediately. After a match: catalog registered at return (PLAY restarts
  anyway).
- Stall watchdog exercised twice in one boot (auto relaunch, menu reached).
- arm64 sha bde0b9cb…; override removed.

## Update 17:00 — r13 built (not installed; on phone as override, loads on next game start)
- PLAY button turns amber '↻ RESTART & PLAY' when nextPlayRestarts (Gear Up opened or match played); match tab
  description warns before Gear Up; Gear Up tap status mentions the restart. arm64 sha e816ba87…

## Update 19:35 — r14 (universal hook relays) REVERTED; OnePlus back on r13 (arm64 e816ba87…)
- Redmi Note 10 Pro (Android 13, no root): Play fails, 7 hook sites unhookable (no free memory within ±128 MB of
  libgame; nearest gaps 139 MB below / 204 MB above). Redmi still runs r14 (installed via adb install-multiple -p).
- r14 added mac_port/nearhook.js (relays in libgame zero padding, caves.js from generate_caves.py, 29 FRAGILE
  sites). Redmi: probe 96/96, menu OK (match not confirmed). OnePlus: match load died twice with SIGILL at
  libgame+0x3cd64d4 = inside a relay in cave 0x3cd6488 (backtrace via libgame+0x3ccca54). Owner: revert.
- Source now has RELAYS_ENABLED=false (helpers = plain Interceptor). Investigate before re-enabling: relay layout
  in that cave, relocation of the site's first instruction (sites 0x3ccd18c/0x3ccf91c share that cave), and
  whether the protected VM checksums/rewrites that padding.

## Update 12 Nov 14:10 — r17 INSTALLED (current) + release/WZM_Offline_r17
- Operator + skin persistence: pipeline.js saveOperator/restoreOperator → files/wzm_operator.tsv (operators[0..1],
  selectedOperatorIndex, operatorCustomization[opRef] skin/chroma/execution/taunt/intro). Skins restored through the
  operator's skin list (OPERATOR #x072145c734039267f → field #x0a44bec41ef81a271). Auto-save waits for a clean restore.
  Owner verified in matches with several skins.
- Gear watch: 15–25 s quiet window after a UI reset (no more false "GEAR UP tap" auto-open).
- Dev Lua console (files/wzm_lua_in.lua → wzm_lua_out.txt) is in entry.js; runner luarun.sh (root only).
- Built with absolute paths: build_r7.py --source $PWD/signed_five_split_r16 --output $PWD/signed_five_split_r17.
  arm64 split sha 4a60de98…; installed by inherit session; override removed; data 13 GB intact; boot shows r17.
- Open: black 3D previews (frontend client never connects; real CLIENT_CONNECT=8, faked 4).

## Update 12 Nov 14:40 — r18 INSTALLED (current) + release/WZM_Offline_r18
- Camera row in MATCH tab: mac_port/camera3p.js (port of lua_bridge/tp_terminal_agent.js: predicate 0x1f6e840 forced
  true for the local PS from camera callsite 0x2326aac x24). Hooks only while 3P is on; pref `thirdPerson`, re-applied
  in beforeMatch. Owner verified live toggle in a match.
- Ball idle fade goes to BALL_FAINT 0.16 (was 0): faint tap → normal, next tap → menu. Owner verified.
- arm64 split sha bdf732b2…; installed by inherit session; override removed; data 13 GB; boot shows r18.

## 12 Nov 15:10 — black 3D previews: root cause + partial fix (dev override only, NOT in r18)
- Menu 3D room = local "Local FrontEnd" server on mp_frontend_mgl, gametype 0x1c6cf30db9f1a772.
  Manager 0x3aae118 (state @0xc115e60, table 0x631584): state 3 waits fences ONLINE(13) & NETWORKING(2) via
  0x36ae29c (return sites 0x3aae2a0/0x3aae2b0); NETWORKING=4 offline, ONLINE stays 1. State 4/5 → 0x3cc990c(map)
  → hostname "Local FrontEnd" (0x3ce83ac(1)) → 0x3cf0b78/0x3cf0cf0 spawn. CDNI (0x12c6220) is idle in state 24: not it.
- Passing ONLINE alone → game's protected exit (finish-and-remove-task 1.2 s later).
- Passing ONLINE + host bypass on at 0x3cc990c entry (pipeline.js wzmSetFlow patch, globalThis.wzmHost) → server
  spawns, client connects (clc0=8, real CLIENT_CONNECT=4), humanInWorld; game stays alive.
- Host match-only steps gated by host.global.wzmFrontend (no uiGate in-match UI restart, no LUI class_select).
- REMAINING WALL: entering the room triggers the game's own LUI rebuild; afterwards the root menu stays fenced
  (fence 9 onlineServices perController fenceState=3), flowManager element has 0 children, persistent_bg loading
  picture covers the screen. Class-level fence skip makes the group pass but the main menu is not rebuilt.
- Also: humanInWorld removes host connect-steer hooks → PLAY after the room must use the restart path.
- Dev tools: files/wzm_js_boot.js / wzm_js_in.js → wzm_js_out.txt (File.writeAllText doesn't truncate: read head).
  Probe scripts in the session scratchpad (fe4/fe5.js).
- 15:12 follow-up: after the room's world entry the root menu's FenceGroup is framed every frame but stuck on
  fence 9 onlineServices (perController fenceState=3). skip_online_fences early-returns when _WZM exists (bug: a
  rebuilt FenceGroup class keeps _WZM) — clearing _WZM and reinstalling, or class-patching the 18 online fences,
  makes the group pass, but each time the UI resets again within seconds (check_unlock_state unlock=false) and the
  main menu (flowManager element) is never rebuilt. No Lua error caught by xpcall wrappers on MenuBuilder/FM.
  Next: trace native UI reinit triggers (reinit 0x33790e8 called from frame 0x337c1c0 @0x337c14c) to find what
  requests the restart after the fence group passes in-world.

## 12 Nov 15:45 — black 3D previews FIXED (dev override; not yet in an APK)
- Cause of the menu not returning after the room loads: Lua errors in main-menu build → error callback
  *(0xae8c490) → request UI restart 0x337c03c(2). Errors: (1) FTUE gate (skip's CONDITIONS/FTUE patch not re-applied
  because the skip early-returns on a surviving _WZM); (2) squad 3D models loop `for i=1, SOCIAL[166b1673577a0458]
  :GetValue()` nil offline (MainMenuMobileUtils chunk 432e284d9710a3ea8 line 619). Decoder: analysis/lua_error_locate.py.
- Fix in pipeline.js: startFrontendRoom() (after boot unlocks, not in pending-match boots): pass fences at
  0x36ae29c for return sites 0x3aae2a0/0x3aae2b0; at 0x3cc990c set host.global.wzmFrontend + wzmSetFlow(true).
  Keeper reset path runs LUA_SKIP_REARM_HEAD (SOCIAL party size → 0, clear _WZM) + skip; then a second skip pass
  fixes the game's PLAY button. frontendStarted ⇒ PLAY always restarts (room used the host's one-time steer hooks).
  Opt-out file: files/wzm_no_frontend_room.
- Verified: main menu backdrop is the 3D room; Operators screen shows the live 3D model; Weapon Select shows the gun
  with camo; Gear Up opens; RESTART & PLAY → Nuketown match spawned.
- Also fixed: storage.write now truncates (File 'w'); writeAllText left old tails → wzm_pending_match.json corrupted
  when shorter (Crash after Nuketown came back to the menu).

## 12 Nov 16:25 — in-place match after the menu 3D room (UNFINISHED; gated by files/wzm_room_inplace)
Owner wants PLAY with no restart at any time. With the room running (catalog skipped when room is up):
1. Fresh host per match (unload old host) → room server thread runs into freed host hooks (pc in freed trampoline).
   → reuse the boot host; humanInWorld steer-hook removal skipped while host.global.wzmFrontend.
2. Switching game type under the live room server → server-thread fault 0x2678d90 (bt SV_Frame 0x3cf10e0).
3. Holding SV_Frame → main thread blocks ~90 s; prep2 (stops the server thread) then aborts.
4. prep1/prep2/prep3/worldUnload(1) BEFORE setGametype (host patch on 'if(pending){...', wzmRoomStopped) →
   main-thread fault 0x4d597a0 (render, bt 0x44ef4d0 0x3a43164 0x3a04cd8 0x3a020d8 0x3fde228 0x29ba678):
   the frontend CLIENT still draws the room after its world is unloaded. Next: make the client leave the room world
   (cgame/client shutdown or the game's own frontend→match transition) before worldUnload.
`disconnect` appended to the cmd buffer (*(0x54bd608), lock 0x127a0bc(0x25)) had no effect.
Also open: 2nd match in one process (anti-tamper window removal ~8 s, owner earlier said don't pursue; now wants it).
- 17:40 more in-place attempts (all crash): game disconnect 0x15d6268 before teardown → render fault 0x4d597a0
  (fault page PROT_NONE = unloaded room world still drawn); deferring gfx apply → same; no teardown + SV_Frame hold →
  DEV ERROR 0x663393C3 (assert at 0x366355c, main thread via 0x37a2aa8). Room in-place stays gated off.

## 12 Nov 18:10 — r19 INSTALLED + release/WZM_Offline_r19 (guide v0.2)
- Owner choice: 3D room starts only on the first GEAR UP tap of a session (matchCount 0); boot PLAY stays instant.
  Gear tap → startFrontendRoom → UI rebuild (~1 min) → keeper skip + play-button pass → unlockAll({open:true}).
  Fallback open after 150 s. After the room, PLAY = restart (in-place gated by files/wzm_room_inplace; crashes).
- Owner verified on the phone. arm64 split sha 75a68418…; override removed; data 13 GB.
- In-place room→match crash notes above: game's hostStart tears the room down itself; afterwards ECS (0x3a04914) and
  then 0x4cfa740 read freed room memory (0x5d1c68b000 region). Missing: client-side cleanup of the room.

## 14 Nov — no-internet start + logo stall (paused by owner: "later")
- "You appear to be offline" = assets/bootstrap/splash.html offline.js (navigator.onLine false). Patched base
  (build_base_offline_page.py → signed_five_split_r20_page, base sha 9cbe511f…) hides it → just black: the real block is
  elsewhere. INSTALLED on the phone (base only); r19 agent, no override.
- Full offline test (/data/local/tmp/wzm_offtest.sh: svc wifi/data off, start, screencaps, logcat, restore): the game
  freezes on the logo BEFORE the gadget loads (no agent log at all; no WZM_BOOT "deferred Gadget" line) → Java main
  thread likely blocked early. Meta Fetch fails fast (5 s semaphore timeout) — not the block.
- Logo stalls (~most launches today): good boot = LUI frame within 1 s of WAIT_LUI_FRAME; stall = never. Game itself
  freezes in startup; watchdog restarts (max 4, files/wzm_stall_count).
- Tried & removed: agent fakes nativeWifiStateChanged(true,100,true,false) + blocks NetworkStateManager reports
  (caused repeated stalls / no help offline). entry.js keeps installNetworkGuard but it only runs if files/wzm_net_guard exists.
- Next: dump stacks of a stalled / offline process: `debuggerd -j <pid>` (Java) and `debuggerd -b <pid>` (native).

## 14 Nov — muzzle smoke / smoke grenade frame drops (in progress)
- Measured (Crash, placeholder bots, 640p/60): idle 58–60 fps; firing 25–43 fps; GPU busy 67–77% idle → 99% while
  firing (sysfs kgsl gpu_busy_percentage). CPU is not the limit. 540p firing ≈ 40 fps.
- None of the enum quality dvars is particle quality (tested e3f56fe4, d0146f6c, 8dfe778b, 4829dfdd, 34cffc71,
  ee3b5ebc, 144567a6, b96259c9, 9046db7f, a68e6562; several raise cost or cause 300 ms hitches when changed).
- No built-in low-res particle path ("LowResOverlay" is a LUI widget). Owner chose: thinner smoke effects first
  (edit particlesystem data in memory), then maybe a low-res particle buffer.
- Asset type table at libgame 0x53e3458 (physicslibrary=0): particlesystem = 61 (Nuketown: 266 assets, root 128 B
  read at 0x173e80c, then 336 B at 0x173e880 …; see analysis/zone_linker/work/nuketown/index.json). xmodel = 9.
- Next: find the particlesystem headers at runtime (hook Load_XAsset 0x17a7880 / DB add during load, or the
  asset lookup 0x19a9930→0x19a8fe0), identify muzzle/smoke systems (active while firing), decode emitter fields
  (spawn count / size / alpha) and scale them; add Normal/Light/Minimal to the GRAPHICS tab.
- Test tools: session scratchpad js/mon25.js, mon25set.js (25 s per-second fps), /data/local/tmp/wzm_cpu25.sh.
