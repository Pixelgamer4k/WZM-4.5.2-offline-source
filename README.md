# WZM Offline — complete source

Call of Duty: Warzone Mobile **4.5.2** (build 22729281, versionCode 3953), made playable **fully offline** after the
official servers shut down. Everything runs **inside the game's own APK**: no root, no computer and no second app is
needed to play. Release name: **beta v1.0** (internal build **r19**).

What works:

| Feature | Where it lives |
|---|---|
| Boot past the "servers are permanently offline" notice and the online login | `build/offline_bootstrap.html` (start page), `agent/native_boot.js`, `bridge/skip_online_fences.lua` |
| Everything unlocked (guns, attachments, operators, skins, camos, perks, streaks, levels) | `bridge/offline_unlocks*.lua`, `agent/mac_port/pipeline.js` (`unlockAll`) |
| Real matches with real AI bots (TDM + 5 other modes, 7 maps, 4 difficulties) | `bridge/host_spawn.py` → host JS, `bridge/party_bot_inject.js`, `bridge/native_ai_both_sides.js`, `bridge/native_ai_veteran_guard.js` |
| Gear Up loadout editor, loadouts saved and used in matches | `bridge/seed_all_loadouts.lua`, `dump_loadouts.lua`, `pipeline.js` (save/restore) |
| Operator + skin choice saved and used in matches | `pipeline.js` (`saveOperator` / `restoreOperator`) |
| 3D Gear Up (operator / gun previews, 3D menu backdrop) | `pipeline.js` (`startFrontendRoom`) |
| Third-person camera, live toggle | `agent/mac_port/camera3p.js` |
| Live graphics panel (resolution, fps cap, AA, sharpening, textures …) | `agent/mac_port/gfx_live.js` |
| Floating "WZ" ball + OPTIONS panel inside the game window | `agent/entry.js` |
| Re-signed APK accepted by the game | `agent/signature_spoof.js` |
| Works on phones where Frida cannot place short hooks | `agent/mac_port/nearhook.js`, `caves.js` |

## Start here

1. **[docs/00_FOR_AI_ASSISTANTS.md](docs/00_FOR_AI_ASSISTANTS.md)** — the shortest path to rebuild everything, and the rules that keep it from breaking.
2. [docs/01_ARCHITECTURE.md](docs/01_ARCHITECTURE.md) — how the pieces fit together, boot to match.
3. [docs/02_BUILD_THE_APK.md](docs/02_BUILD_THE_APK.md) — tools, inputs, signing key, build chain, exact commands.
4. [docs/03_INSTALL_AND_GAME_DATA.md](docs/03_INSTALL_AND_GAME_DATA.md) — installing on a phone and restoring the 13 GB data folder.
5. [docs/04_FEATURES.md](docs/04_FEATURES.md) — how every feature is done, step by step.
6. [docs/05_ADDRESSES_4.5.2.md](docs/05_ADDRESSES_4.5.2.md) — every engine address, hash and offset used.
7. [docs/06_DEV_TOOLS.md](docs/06_DEV_TOOLS.md) — hot-update, in-game Lua/JS consoles, decoders, emulators.
8. [docs/07_KNOWN_ISSUES_AND_OPEN_WORK.md](docs/07_KNOWN_ISSUES_AND_OPEN_WORK.md) — what is not solved and what was learned.
9. `docs/player/` — the player guide (HTML) and the player install text. `docs/history/` — the original engineering hand-offs (raw notes, in order).

## Folder map

```
agent/            the in-APK controller (Frida Gadget script). entry.js is the entry point.
  mac_port/       pipeline.js (menu/match workflow), gfx_live.js, camera3p.js, stage.js, nearhook.js,
                  mac_sources.js (GENERATED from bridge/ by generate_mac_sources.py)
  host/ gear/ unlock/  earlier in-process ports and their tests (kept for reference; r19 uses mac_port/)
build/            APK build chain (Python), offline start page, gadget config, hot-update + Lua console scripts
  lua/            ~80 small Lua probes used while reverse-engineering the menus
bridge/           the original Frida/Lua scripts (first developed from a computer over ADB). The agent embeds them.
tools/            zone_linker (fastfile loader emulators, call-graph helper), lua_decode (LuaJIT bytecode → source lines), perf
legacy_mac_kit/   the earlier computer-driven toolkit (TUI launcher, setup scripts) the in-APK version replaced
docs/             all documentation
```

## Not included (on purpose)

- **No game files.** No APKs, `libgame.so`, game assets or the 13 GB data folder. You must use your own legally obtained
  copy of Warzone Mobile 4.5.2 (see docs/02 and docs/03).
- **No signing key or password.** Create your own key (docs/02). The APK only has to be signed consistently.
- **No Frida Gadget binary.** Download `frida-gadget-17.x-android-arm64.so` from the official Frida releases (docs/02).

All personal names, paths, device identifiers and addresses were removed. Device-specific values are placeholders:
`PHONE_IP` (your phone's ADB-over-Wi-Fi address), `USB_SERIAL`, `PHONE_MODEL`, `$HOME`.
