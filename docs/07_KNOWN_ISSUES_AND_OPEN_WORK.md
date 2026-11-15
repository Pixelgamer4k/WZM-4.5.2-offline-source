# Known issues and open work

Honest state as of this snapshot. Nothing below is a finished fix.

## Starting without any network
With Wi-Fi and mobile data both **off**, the game freezes on the Activision logo **before the Gadget even loads** — so
the agent can't help from where it currently runs. The game's two startup fetches (a settings file and an ipstack
region lookup) fail fast after 5 s and aren't the blocker; the block is earlier in Java/native startup. The engine
also only ever hears "network not connected" (`NetworkStateManager.nativeWifiStateChanged`), which was a suspected
cause, but faking "connected" from the agent didn't help (and caused repeated logo stalls). The current builds boot
fine with Wi-Fi on even when nothing is reachable, so the practical workaround is "keep Wi-Fi on, no internet needed",
or your phone's per-app internet block. The disabled "offline" box (offline.js) only hides the message; it doesn't make
the game continue. **Not solved.** Next step: dump all game thread stacks (`debuggerd -j`/`-b <pid>`) at the moment it
is frozen with networking off, and find what the main thread is blocked on.

## Logo stalls
~Half of launches freeze on the logo. The watchdog relaunches (max 4). Root cause not found; the game itself freezes
during startup, before its UI Lua begins. Same "dump stacks while frozen" step applies.

## Instant PLAY after the 3D Gear Up room
PLAY straight from the 3D menu into a match crashes: after the game tears the room down, parts of it (ECS update
`0x3a04914`, then `0x4cfa740`) still read the freed room memory (`0x5d1c68b000` region); forcing past one crash moves it
to the next. Online, the engine takes the client out of the room before loading the match; that client-side cleanup
wasn't located (`disconnect` `0x15d6268` alone didn't trigger it). So PLAY after the room uses the one-time restart.
**Workaround shipped; proper fix open.**

## Second match in one process
The game's protection closes a second match in the same process ~8 s in. Unsolved; the restart path avoids it.

## Muzzle smoke / smoke-grenade frame drops (in progress)
Firing takes the GPU from ~70% to 99% (CPU is fine), dropping 60 → ~25–40 fps; it recovers the instant you stop. None
of the engine's enum quality dvars is particle quality (ten tested; several made it worse or hitched). There is no
built-in low-res particle path. Chosen plan: **thin the particle effects in memory** (edit `particlesystem` assets,
type 61 — fewer/smaller/lighter smoke particles), optionally a low-res smoke buffer after. Found: the particlesystem
asset type and header layout, and a loader hook that lists them as a match loads. Still to do: identify the muzzle /
grenade systems, decode the emitter fields (spawn count / size / alpha), scale them, measure, and add a
Normal/Light/Minimal option. **Do not** use `MemoryAccessMonitor` to find which systems are active — engine worker
threads fault on protected pages and the game dies (learned here).

## Graphics settings that are unsafe
- Texture pool sizes are fixed at renderer init; raising them at boot crashes every launch.
- Ultra textures overflow the stock pool (grey flicker). Lighting/GI upgrades and some advanced options crashed
  matches. All excluded or opt-in only. Only the dvars in `gfx_live.js` are exposed.

## Map porting (Rust, Luxury, Shipment) — paused
Old maps exist from game versions 2.11.3 (Luxury) and 3.3.2 (Rust, Shipment), but their fastfiles are **format 23**
while 4.5.2 only loads **format 25**. A full per-asset-type converter is required (the risky types are shaders and
physics/collision). The loader emulators (`tools/zone_linker/emu.py` / `emu332.py`) run the games' own loaders on the
decoded zones to recover asset layouts; `emu332.py` has a known bug (a skipped stream-read helper returns the wrong
address, so after ~80 assets the asset list is overwritten — fix: fake the pointer-ref helpers like `emu.py` does for
4.5.2). The owner paused this: quality/effort didn't justify it. See `docs/history/` for the detailed map-port notes.

## GPU hangs on hot phones
Occasional freeze-then-crash under load = Adreno GPU hang (seen in dmesg). Cause unknown; let the phone cool.

## Device compatibility
Tested on one arm64 phone (Android 16). On some phones (e.g. a Redmi Note 10 Pro, Android 13) the menu works but PLAY
fails with "unable to intercept function": no free memory within ±128 MB of the 222 MB `libgame.so` for a hook relay.
`nearhook.js`/`caves.js` cover most sites via code caves, but not all. Collect `Export Logs` from such a phone.
