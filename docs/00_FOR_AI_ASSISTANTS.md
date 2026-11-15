# For AI assistants: how to reproduce this project

Read this file first. It is the condensed playbook; the other docs give detail.

## 1. What the end product is

A re-signed copy of Warzone Mobile 4.5.2's five split APKs where only two things differ from the original:

1. **`base.apk`**
   - `assets/bootstrap/index.html` is replaced by an offline start page that tells the game's Java/JS bridge
     `sysReady` → `passPreloginFence` → `closeWebView`. That skips the online pre-login page, which now only says
     the servers are offline.
   - `classes.dex` gets a small smali patch: 25 s after `GameApplication.onCreate`, in the main process only, a thread
     calls `System.loadLibrary("gadget")`.
   - `AndroidManifest.xml` gets `extractNativeLibs=true` and one permission.
   - Optionally, `assets/bootstrap/offline.js` has its "you appear to be offline" box disabled.
2. **`split_config.arm64_v8a.apk`**: three added libraries.
   - `libgadget.so`: the official Frida Gadget 17.x, arm64.
   - `libgadget.config.so`: JSON config with `interaction: {type: script, path: libgadget.script.so}`.
   - `libgadget.script.so`: our compiled agent (`agent/entry.js` bundled with `frida-compile`).

`libgame.so` and all game assets stay **byte-identical** (sha256 of libgame.so: `c8f5e9df…7d7`). Every feature is done
at runtime by the agent, which hooks the engine (Frida Interceptor/CModule) and runs Lua inside the game's own UI Lua
state (LUI).

## 2. Minimal rebuild path (assuming the reverse engineering is already done, as in this repo)

1. Get your own 4.5.2 split APKs (`adb shell pm path com.activision.callofduty.warzone` → pull the 5 files) and the
   13 GB `Android/data/com.activision.callofduty.warzone/files` data folder (docs/03).
2. Install the tools from docs/02: Python 3.11+, apktool, Android build-tools, Node + `frida-compile` 14,
   and the Frida Gadget 17 arm64 `.so`.
3. Create your signing key (docs/02 §3).
4. Put the offline start page into `base.apk` (`build/build_offline_bootstrap.py`, or replace
   `assets/bootstrap/index.html` with `build/offline_bootstrap.html` when building).
5. Run the build chain (docs/02 §5). For day-to-day agent changes only `build/build_r7.py` is needed: it recompiles
   `agent/entry.js` and swaps `libgadget.script.so` inside the arm64 split.
6. Install over the existing game, or fresh with the data folder restored (docs/03). Never uninstall a working install.

If the game version is **not** 4.5.2 build 22729281, every address in docs/05 is wrong and must be found again. The
methods for finding them are described in docs/04 and docs/06.

## 3. Rules that keep it working (each learned the hard way)

**Install and data**
- **Never uninstall** the game on a working phone: Android deletes the 13 GB data folder. Always update by installing
  over it (same signing key). For agent-only updates replace just the arm64 split (`pm install-create -p <pkg>` +
  `install-write … split_config.arm64_v8a.apk` + `install-commit`).
- All five splits must be signed with the **same** key. `agent/signature_spoof.js` makes the game see the original
  publisher certificate when it asks PackageManager; without it the game exits.

**Startup**
- **Load the Gadget late (25 s) and only in the main process.** Loading it in `<clinit>` or in helper processes
  crashed or stalled startup. The agent then waits ≥15 s more before touching the engine (`native_boot.js`).
- **Logo stalls** (the game freezes on the Activision logo) happen often. The watchdog in entry.js relaunches when no
  UI Lua frame arrives for 35 s, at most 4 times in a row (`files/wzm_stall_count`). The root cause is not fixed.

**UI Lua (LUI)**
- Most keys are `xhash` values: a separate Lua type with no literal syntax. Find a key by iterating and comparing
  `tostring(k)` with `'xhash: #x…'`.
- Globals are strict: use `rawget(_G, …)` and `rawset(_G, …)`.
- `debug` only has `traceback`.
- `pairs()` over player-data (DDL) nodes never ends because it cycles field names. Stop at the first repeated key,
  skip `__pad`, and walk arrays by `#len`.
- Any Lua error inside a menu build **resets the whole LUI**. All runtime Lua patches are lost.
  - The keeper (every 10 s) detects this and re-applies them.
  - The online-fence skip must clear its `_WZM` marker table first (`LUA_SKIP_REARM_HEAD` in pipeline.js); otherwise
    it thinks it is still installed.

**Agent runtime**
- Frida `File.writeAllText` does **not** truncate. A shorter write leaves the old file's tail behind; this corrupted
  `wzm_pending_match.json`. Write with `new File(path, 'w')`.
- **Gear Up's weapon catalog** (registering 657 weapon definitions) breaks the next match load (DEV ERROR
  0x1BEE3C2D). The **second match in one process** is closed by the game's protection about 8 s in. So after Gear Up
  or a match, PLAY saves loadouts, writes `files/wzm_pending_match.json`, restarts the game, and the new process starts
  the match by itself.
- **Hooks cost CPU.** Hot paths are native CModule code inside the host. JS `Interceptor` hooks on per-frame functions
  added about 15% CPU. Do not attach to a function the host already replaced (`Interceptor.replace` fails with
  "wrong type").
- **Do not use `MemoryAccessMonitor`** (page protection). Engine worker threads fault on it and the game dies.

**Graphics and gameplay**
- Graphics dvars: some writes are only safe at specific times.
  - Texture pool sizes are fixed at renderer init; raising them at boot crashes every time.
  - Several quality enums cause 300 ms hitches when changed mid-match.
  - Use only the ones in `gfx_live.js`.
- The menu 3D room is a real local server. Going from it straight into a match in the same process crashes (freed room
  memory is still read), so PLAY after the 3D room uses the restart path.

## 4. How to debug on a phone (root makes it fast)

- Hot update without reinstall: `build/push_override.sh` compiles the agent and writes it to
  `files/wzm_agent_override.js`. `agent/loader.js` prefers that file. Delete the file to go back to the embedded agent.
- In-game Lua console: write a file, it runs inside LUI, and the result comes back (`build/luarun.sh file.lua`).
- In-game JS console: `files/wzm_js_in.js` (run on change) and `files/wzm_js_boot.js` (run at agent load). Output goes
  to `files/wzm_js_out.txt`; read it from the top, because the file is not truncated.
- Agent log: logcat tag `WZM`, mirrored to `files/wzm_offline.log`. The ball → Export Logs shares it without a computer.
- Lua error → source line: `tools/lua_decode/lua_error_locate.py <chunk hash> <line>`. It decodes the original LuaJIT
  bytecode from `global.ff`.

## 5. Order in which the original work was done (useful if you restart from zero)

1. Read the game: unpack the APK, decode the encrypted CDN manifest, dump the UI Lua from fastfiles.
2. Get to the main menu offline. The servers are gone, so the online fences never pass. Patch the online fences in Lua
   (`skip_online_fences.lua`) and replace the bootstrap page.
3. Start a local server from the menu (`host_spawn`). The protected VM has to be steered (`WZM_VM53_STEER_PIN`), and
   the client gets a forced loopback connection (`WZM_FORCE_LOOPBACK`).
4. Add bots: test clients, then real AI (`native_ai_both_sides`) and a difficulty guard.
5. Unlock all items by wrapping the ownership checks in Lua. Fake player data (`fake_player_data`). Register weapon
   definitions so Gear Up opens.
6. Save and restore loadouts and operators to files in the game's private storage.
7. Move everything from a computer (Frida over ADB, root) into the APK (Gadget), with no root and no computer. Run the
   original scripts unchanged through `mac_port/stage.js`.
8. Polish: in-game ball UI, live graphics, third person, 3D Gear Up.
