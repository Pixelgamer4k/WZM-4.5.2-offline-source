# Device preparation, validation and recovery

## Supported starting point

This source targets the **exact original Warzone Mobile version 4.5.2.22729281**, compatible ARM64 Android with root, sufficient RAM/storage for the original game, a Mac with Python 3 and Android platform-tools, and matching Frida 17.23.3 on Mac and the phone. Native addresses were discovered from one original game `libgame.so` image with SHA-256:

`c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7`

Verify those pinned bytes locally if you have the original files:

```zsh
python3 tools/verify_game_build.py --base "<YOUR_ORIGINAL_BASE_APK>" --libgame "<YOUR_ORIGINAL_LIBGAME_SO>"
```

A package with a different ELF version/architecture, repackaged binaries, missing splits, missing cached map shards or different Android dependencies may fail or crash. Exact hash agreement is **necessary for the current native offsets, not a guarantee of device compatibility**.

**No official game binaries are provided.** Use only the original app and its legitimately obtained data. You must prepare your own already-installed matching split APKs (base, ARM64 configuration, locale, asset pack and density), along with the original game data/cache. Do not clear or replace app data without a backup. Installing an alternate signature can invalidate existing data; this source does not automate application installation or bypass ownership checks.

## Mac environment

1. Install `python3`, `zsh` and Android `adb` (platform-tools).
2. Run `./setup_mac.sh` to create `analysis/frida_venv` and install `frida==17.23.3`.
3. Connect the phone to your Mac with ADB (USB is recommended for initial diagnostics). For network ADB, use the ordinary system `adb connect` command with your own device information.
4. Run `./configure.sh "<YOUR_ADB_SERIAL_OR_IP:PORT>"`. This writes a file under your private home configuration directory and does **not** write your device ID into the source package.
5. Run `./run.sh doctor`. It checks Python Frida, ADB reachability and device CPU architecture, but is **not** a game compatibility proof.
6. On the rooted phone, prepare a **phone-side Frida server version 17.23.3** listening on localhost port `27042`. The package does not ship a Frida server or install it automatically. The reference scripts use ADB forwarding and root-only diagnostics; `su`, `nsenter` and root debugger access must work in your environment.

## Build the bootstrap from your own unmodified base APK

The original base APK must match SHA-256 `a8252312ecda283b845f4fbac36b97c1d5dea95957f8ea737c869fce181da553`. Do not use split_asset_pack.apk or a repackaged file as the input.

```zsh
python3 tools/build_offline_bootstrap.py --input "<YOUR_ORIGINAL_BASE_APK>" --check-only
python3 tools/build_offline_bootstrap.py --input "<YOUR_ORIGINAL_BASE_APK>"
```

The builder performs a single embedded HTML replacement and then checks that the complete result has SHA-256 `1a2065b43623364895892b73b5d0be7d42ad345f7742f6aed83fcd164994f6e9`. The result is saved in a private local directory by default. It cannot be normally installed, because the original signing certificate is not available; it is meant for an **ephemeral bind mount only**.

Use `./run.sh mount --dry-run`, and only after backing up and verifying the target install, explicitly run `./run.sh mount --apply`. This pushes the generated bootstrap to your own device, verifies SHA-256 on-device, resolves that device's **current** installed `base.apk`, and uses `nsenter -t 1 -m -- mount --bind` to apply it at runtime. It does **not** overwrite the installed APK on disk. Root namespace behavior depends on the device. Any mount failure must stop the process; never force a path guessed from another phone.

For recovery, stop your portable Mac controllers using `./run.sh stop`, then (with the game closed) use `./run.sh unmount --apply`. A full phone reboot also drops this temporary bind mount. This does not undo earlier runtime hooks inside a still-running game process; close/restart the game if reverting experiments. Do not share files generated in the private bootstrap output directory.

## Running a match

The primary launcher uses a Mac-hosted Frida connection and **must remain running throughout gameplay**. For example:

```zsh
./run.sh play crash 1 1 1800
```

One `Ctrl+C` should stop its supervised Mac process group; use `./run.sh stop` if an older controller was orphaned. The stop command checks the project's own process state and workspace before stopping orphaned scripts. It never clears app data or touches unrelated workspace controllers. Observe actual `clientEnterWorld`, `botInjectFinal`, team and difficulty fields in runtime logs before declaring a match playable.

## Maps, bots and alternate modes

`./run.sh maps` and `./run.sh modes` describe the known modes/maps. Native Veteran bot creator supports up to eight genuine AI bots total, at most six on either team. Three- or four-per-side teams may have significantly lower performance, especially on larger maps.

**Search & Destroy** has an original game mode (`mp_sd` hash `0x1dbcd710fe215368`) and `omnvars/mp/gametypes/omnvars_sd.csv` asset. Selecting its hash is **not** sufficient to prove authentic round resets, planted-bomb objectives, defusing, end-of-round scoring, and bot tactics. The experimental CLI exists only for research; it must not be presented as fully playable S&D without on-device evidence.

## Failure precautions

- If the game stops at the Activision logo, do not leave multiple launch controllers running or configure infinite retries. Stop the Mac controller; preserve your installed game and data.
- A process PID is not proof of a booted game. A callback, native host startup and a local player in the game world must be verified.
- Do not launch a match when the device battery is critically low or overheating.
- If the app disappears from PackageManager after reboot, do not wipe user data; investigate package install/scan issues, preserve logs and use owned original files only.
- The optional phone-only autostart source is a separate **unverified prototype** and does not replace the working Mac gameplay host. It is not installed by this package.
