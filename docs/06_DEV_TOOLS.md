# Developer tools and workflow

These are how the project was reverse-engineered and is iterated. Most need **root** on the test phone (hot update and
the file-based consoles write to the game's private `files/`). A non-root phone runs the built APK fine; it just can't
be poked at live this way.

## Hot update (no reinstall)
`build/push_override.sh` compiles `agent/entry.js` and writes it to `files/wzm_agent_override.js`. `agent/loader.js`
prefers that file over the embedded agent, so a new agent runs on the next game launch. Delete the file for release.
Set your phone's ADB address with `WZM_DEV=PHONE_IP:5555`.

## In-game Lua console
`build/luarun.sh file.lua` pushes a Lua chunk that runs **inside the game's UI Lua state (LUI)** on the next frame and
returns its value. This is how the menus, fences, loadouts and operator data were explored. `build/lua/` has ~80 ready
probes (dumping menus, fence groups, the dvar table, loadout structures, etc.).

## In-game JS console
With the dev agent loaded, `files/wzm_js_in.js` runs when it changes and `files/wzm_js_boot.js` runs at agent load.
Output and `dlog(...)` lines go to `files/wzm_js_out.txt`. **Read it from the top** — Frida's file write doesn't
truncate, so new output is at the start and stale text remains at the end.

## Logs
logcat tag `WZM`; also mirrored to `files/wzm_offline.log`. In the game, the ball → Export Logs shares it.

## LuaJIT bytecode → source lines (`tools/lua_decode/`)
`lua_error_locate.py <chunk hash> <runtime line> [context]` decodes the original compiled Lua behind a live error. It
finds the chunk by its hash in `global.ff` (zlib streams), then disassembles the proto around the line. This turned
every "attempt to index a nil value" in a menu into an exact bytecode location. Helpers: `ljbc_proto_inspect.py`,
`menu_route_ljbc_decode.py`, `ff_luajit_stream_index.py`.

## Static analysis (`tools/zone_linker/callg.py`)
A tiny ARM64 call-graph/disassembly helper over `libgame.so` (needs `capstone`, `numpy`):
- `callg.py <lib> callers <va>` — BL sites that call a function
- `callg.py <lib> dis <va> [n]` — disassemble
Used throughout docs/05 to find functions, callers and branch targets. Point it at your libgame with `WZM_LIBGAME`.

## Fastfile loader emulators (`tools/zone_linker/emu.py`, `emu332.py`)
Run the game's **own** zone loader (`DB_LoadXAssets`) on a decoded zone inside Unicorn, faking only the stream read,
alignment and block push/pop. They record every stream read and every pointer the loaders store, which is how asset
layouts were recovered without the game running. `emu.py` = 4.5.2; `emu332.py` = 3.3.2 (old maps). See docs/07 for the
map-port status. Point them at your libgame with `WZM_LIBGAME` / `WZM_LIBGAME_332`.

## Performance measuring (`tools/perf/`, and the js probes used in this session)
- Per-second fps while playing: a JS probe hooks the UI frame and prints frames/sec and max frame time each second.
- Per-thread CPU + GPU busy: a shell loop reads `/sys/class/kgsl/kgsl-3d0/gpu_busy_percentage` and `top -H`.
  This is how the muzzle-smoke drop was identified as GPU-bound (99% while firing).

## A note on method
Almost nothing here guesses. The pattern is: find the engine function statically (callg.py / strings), confirm it live
(luarun / js console / a light Interceptor hook that only logs), then make the smallest change and measure. When a
change crashes, the native crash witness in the agent prints the faulting PC and a backtrace to `wzm_offline.log`,
which points at the next function to understand.
