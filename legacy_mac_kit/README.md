# Warzone Mobile 4.5.2 — portable offline development source

A **source-only**, privacy-scrubbed archive of the experimental offline main-menu, local-host, multiplayer and native-AI work for **Warzone Mobile 4.5.2.22729281**. It is saved separately from the development workspace.

**Scope:** Mac-hosted Frida instrumentation and a compatible, *already installed*, rooted ARM64 Android device. This is not an Android APK, an offline game installer, a stand-alone game engine, or a guarantee that every Android device will run this version.

## Verified vs experimental

| Feature | Evidence/status |
|---|---|
| Offline frontend/main menu | Previously achieved on one reference rooted phone; different-device reproduction **not yet proven** |
| Multiplayer maps Crash 2 and Nuketown | Playable TDM previously confirmed on reference phone; not retested with this distribution |
| Genuine bots | Reference native bot client creation, movement and combat; Veteran bots on both teams previously verified |
| Verdansk | Playable on reference device after in-memory asset-pack registry correction, if complete map assets already installed |
| Rebirth and other listed maps | Less-tested; requires matching installed assets and may not load |
| Weapon, skin and operator menus | Existing unlock/selection flows; some preview and save/restore behavior incomplete |
| Search & Destroy | Exact original `mp_sd` hash and mode-specific assets identified; **bomb planting, defusing, rounds and bot objectives not verified offline** |
| Domination, Hardpoint, Frontline, Kill Confirmed | Original native gametype hashes known; gameplay rules not validated offline |
| Battle Royale | Not validated as a complete playable offline match with AI |
| Other phone brands, SoCs and Android versions | **Untested**. Native `libgame.so` offsets require the *exact matching original 4.5.2 build*. |

**Do not share this as a completed universal offline game.** The original mobile game, installed split APKs, FastFiles/shards, textures, maps, sound, cache, fonts and other proprietary content are deliberately NOT distributed here. A separate device must already have its own legitimate compatible game installation and game data. The current code cannot reconstruct absent proprietary game content.

## Project layout

- `run.sh` — self-service entrypoint, safe managed TDM launcher, experimental native gametype selector, loadout/menu commands.
- `setup_mac.sh` — Python virtual environment and matching Frida Python package.
- `configure.sh` — stores your private ADB device identifier **outside this source folder**.
- `analysis/frida_tools/lua_bridge/` — local-host, native AI, Lua/frontend and optional experiment source.
- `analysis/user_tools/session_manager.py` — Ctrl+C/group cleanup and **workspace-scoped** orphan detection; never terminates other projects based solely on matching script names.
- `bin/adb` — tiny adapter mapping a neutral command placeholder to the user's own configured device; none of the imported scripts contain a personal device address.
- `tools/build_offline_bootstrap.py` — rebuilds a checksum-pinned runtime-only offline bootstrap from **your own** matching original `base.apk`.
- `tools/mount_offline_bootstrap.sh` and `unmount_offline_bootstrap.sh` — explicit, checksum-guarded **reversible root bind mount**; default dry run.
- `optional_phone_autostart/` — source of an older experimental on-phone module; NOT a supported replacement for the Mac gameplay host, and no proprietary binary injector is bundled.
- `audit/` — inclusion/exclusion counts, relative-path SHA-256 manifest and source privacy audit.

## Quick start on a Mac

Read [DEVICE_SETUP.md](DEVICE_SETUP.md) before interacting with another phone. On a compatible machine:

```zsh
cd WZM452_Offline_Portable_Source
./setup_mac.sh --check
./setup_mac.sh
./configure.sh "<YOUR_ADB_SERIAL_OR_IP:PORT>"
./run.sh maps
./run.sh modes
./run.sh doctor
```

You will need to acquire/provide a **matching phone-side Frida server v17.23.3** on your own (not bundled); start it on the rooted device on port `27042` and make sure local ADB forwarding works. The phone's own game assets need to have been installed or downloaded earlier. Verify the original `base.apk` SHA-256 before generating the private bootstrap:

```zsh
python3 tools/verify_game_build.py --base "<YOUR_ORIGINAL_BASE_APK>" --libgame "<YOUR_ORIGINAL_LIBGAME_SO>"
python3 tools/build_offline_bootstrap.py --input "<YOUR_ORIGINAL_BASE_APK>" --check-only
python3 tools/build_offline_bootstrap.py --input "<YOUR_ORIGINAL_BASE_APK>"
./run.sh mount --dry-run
./run.sh mount --apply
```

The patch is **not** a normally installable APK: it can only be placed as a temporary root bind mount over a legitimate installed base APK. The modified APK is saved privately under your local home directory by default and must not be bundled into this source archive.

After that, **only if your device is compatible and you have made a full backup**:

```zsh
./run.sh play crash 2 2 1800             # TDM, two enemy + two friendly Veteran bots
./run.sh play nuketown 5 0 3600
./run.sh menu 7200                        # experimental loadout/menu startup
# in another terminal after menu is ready:
./run.sh loadouts
./run.sh experimental sd crash 2 2 1800  # experimental native S&D, NOT verified actual S&D rounds
./run.sh stop                             # stop Mac controllers from THIS source folder only
./run.sh unmount --dry-run                # optional cleanup preview
```

These commands **have not been live-tested from this portable package on a second device**. Use `./run.sh --help` for the complete command syntax. For some workflows, starting a cold match after editing loadouts can reset frontend state; persistence is not guaranteed. Avoid overlapping cold boots; the package defaults to `WZM_BOOT_TRIES=1` to prevent repeated logo stalls. If the original development workspace is already running a game controller, the portable supervisor refuses a concurrent cold launch. The source package's `stop` command will **not** terminate that other workspace.

## Privacy and distribution

The source files were copied to a new folder, with original account-specific Mac paths, the reference phone's ADB address and explicit personal identifiers stripped. Private device configuration is stored under `~/.config/wzm452-offline/`, *outside* the source tree. Original runtime logs, screenshots, saves, personal files, security keys, game APKs, `.so`, FastFiles, map shards, downloaded assets and decoded proprietary content were excluded. See `audit/PRIVACY_AND_PORTABILITY.md` and run `python3 tools/audit_source.py` before sharing.

**Copyright/licensing:** This folder reflects reverse-engineering and experimentation with a third-party commercial game. It contains only selected project-authored tooling and related development scripts; it grants no permission to redistribute Activision software, game content, or external third-party dependencies. Examine individual code origins and permissions before publishing even the source. It is not affiliated with or endorsed by Activision.
