# WZM 4.5.2 original Gear Up/profile — guarded v5 in-process integration

This directory is embedded into the isolated v5 Frida agent. Its original
v4 standalone source port and the prior signed v3/v4 packages are unchanged.
The v5 UI now offers a separately consent-gated experimental
`tryOriginalGearMenu` action after authentic in-process catalog, preview
guard, native profile DDL, archived hub and fifteen-class readback stages.
It calls the exact original `open_gear_up.lua` inside the one verified
native LUI-frame owner. A successful `RequestAddMenu` return is reported as
`ORIGINAL_GEAR_MENU_REQUEST_CALLED_RENDER_UNVERIFIED`; it is NOT considered
proof that models, characters, cosmetics, frontend clients or the editor
actually render. `openGearUp` remains a fail-closed check until on-device
visual confirmation and model streaming are proven.

**Mac static/source-only prototype — 10 November 2026.** Everything in this
directory is new and isolated. No user phone, ADB, root access, installation,
game process, original signed v3 APKs, or v4 prime-owned agent/entry/builder
files were touched. The compiled Frida source has not been injected into
Warzone Mobile on an unrooted handset.

## Real original sources and what was preserved

The implementation was inspected against the originals under
`/projects/WarzoneMobileOffline/analysis/frida_tools/lua_bridge`:

| Original | Native or Lua behavior | Scoped implementation |
|---|---|---|
| `fake_player_data.py:10-35` | `mmap(0x66000)` for missing group 0/1 buffers; original per-group flags `0x244/0x247`; task-state writes; original `0x331aaec` bindStats(0,0/1,group) on live LUI frame | `profile_native.js`, guarded preflight and native readback |
| `fake_player_data.lua:1-10` | Writes synthetic Ranked XP 100000, kills 1234, deaths 617, games 100 | Embedded byte-exact, **optional explicit** `seedSyntheticProfile` + independent DDL readback |
| `restore_hub_binary.py:5-19` | Exact 12082-byte original binary chunk, original menu-key Lua, two `load` and two `pcall` calls | `hub_loader.js` + `native_adapter.js`; independent second-frame menu-key/FlowManager readback |
| `seed_all_loadouts.lua:1-63` | Seeds five starter classes in each of stats groups 3,4,6 with native DDL `:set()` | Embedded byte-exact, explicit opt-in + independent read-only 60-field/15-class verification |
| `frontend_preview_guard.js:1-30` | Original preview update `0x355ca54` and opcode `0xd10703ff`, GOT count/flag/array null-client guard | `preview_guard.js` and native owned replacement/revert, no 3D streaming claim |
| `open_gear_up.lua:1-10` | Attempts menu navigation, with original lifecycle hazards | Embedded byte-exact for provenance, **NOT executed** |

The three original Lua strings and exact compiled hub are generated into
`embedded_assets.js` with per-source SHA256 and byte counts from
`generate_assets.py`. `embedded_manifest.json` records provenance and
the static `input/libgame.so` fingerprint (original SHA256
`c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7`,
GNU build ID `9528f1d264b40639b57e14998e01d080`). The in-process frame
guard checks arch, module size, ELF build ID and six original code windows,
including `bindStats` and the preview function, before any native memory
mutation. The runtime does not hash the entire original ELF in memory.

## Prime integration API — one existing game LUI frame hook

`gear_port.js` exposes `createGearFramePort()` and `GEAR_CONSENT`:

```js
import {createGearFramePort, GEAR_CONSENT} from './gear/gear_port.js';

const gear = createGearFramePort({
  notify(event) {
    // Dispatch to the existing authenticated UI callback asynchronously.
    // Do not use Android Java APIs directly from the native LUI frame.
    enqueueUiEvent(event);
  }
});

// Existing native_boot/entry's ONLY original frame owner:
onVerifiedLuiFrame(context) {
  // context must include L, native load/pcall/toString, runtime,
  // moduleBase, identity, as produced by the verified WZM 4.5.2 supervisor.
  gear.onVerifiedLuiFrame(context);
}
onLuiReset() {
  gear.onLuaReset();
}

// Existing non-game-thread supervisory timer:
gear.heartbeat();

// From an authenticated, explicit user interaction:
const answer = gear.request({
  action: 'prepareNativeProfile',
  requestId: 'gear-001',
  gameVersion: '4.5.2.22729281',
  consent: GEAR_CONSENT.prepareNativeProfile
});
// accepted:true only means queued for a future verified native LUI frame.

// On game-agent shutdown:
gear.dispose();
```

This component **never installs another LUI-frame Interceptor**. It uses only
the calling game's verified native frame and the original Lua state/functions.
`createGearNativeAdapter(context)` uses Frida `Memory`, `NativeFunction`
and, only when explicitly installing preview safety, `Interceptor.replace`.
All code is in the agent process: no Mac scripts or ADB commands are called
at runtime. The `gear/` files must be copied/bundled together, including
`embedded_assets.js`.

## Requests and receipts

All actions are typed, request-ID deduplicated, queued (up to eight), and
expire after 120 seconds without sufficient verified LUI frames. The
`GEAR_CONSENT` object holds exact user-consent strings. The primary steps,
in recommended order, are:

| Action | Explicit consent | True completion condition |
|---|---|---|
| `inspect` | None | Source/native snapshot and read-only `PLAYER_DATA` probe; no mutation |
| `installPreviewGuard` | `GUARD_ORIGINAL_PREVIEW_FN` | Original preview opcode validated and **this agent owns** a reversible native replacement; does not render models |
| `prepareNativeProfile` | `SYNTHETIC_PROFILE_IN_MEMORY` | Original buffer/table pointer checks, `mmap`, game-thread bindStats calls, and native entry flags readback; **not DDL proof** |
| `verifyProfileDDL` | None | New read-only original `PLAYER_DATA` hashed PDO, Ranked root, XP getter and at least one loadout group; **not persistence proof** |
| `seedSyntheticProfile` (optional) | `WRITE_ORIGINAL_FAKE_PROFILE_STATS` | Exact original fake-profile Lua executed, followed by a **separate** read of XP 100000, kills 1234, deaths 617, games 100 |
| `restoreOriginalHub` | `LOAD_ORIGINAL_12082_BYTE_LUAJIT_HUB` | Hub source SHA pinned; exact original load/key-call/hub-call on a native frame, plus independent next-frame gear-key and FlowManager readback. **Not editor rendering** |
| `seedStarterLoadouts` (optional) | `OVERWRITE_15_STARTER_LOADOUTS` | Exact original Lua invoked, then independent read-only verification of 15 class names + 45 weapon IDs in groups 3/4/6 (60 checks). **Not saved across relaunch** |
| `openGearUp` | N/A | Always returns `GEAR_UP_CLIENT_RENDER_NOT_VERIFIED` with native-client, model streaming, and lifecycle blockers; does not execute `open_gear_up.lua` |

The stage order is intentionally not automatic. In particular, profile writes
and loadout seeding overwrite in-process synthetic data and require explicit
consent. No request can create a genuine logged-in game account, real
`CLIENT_CONNECT`, remote player profile or a persistent cosmetic inventory.

Response events:

```js
// Request acceptance (NOT completion):
{accepted:true,code:'WAITING_FOR_ORIGINAL_452_LUI_FRAME',
 requestId:'gear-001',action:'prepareNativeProfile',status:'QUEUED'}

// A later, separately delivered native callback receipt:
{channel:'wzm.gearPort.v4',event:'RESULT',requestId:'gear-001',
 action:'prepareNativeProfile',status:'COMPLETED',
 code:'PROFILE_NATIVE_BIND_INVOKED_NOT_DDL_PROVEN',
 native:{nativeInvoked:true,verifiedDDL:false,readback:{...}},
 ddlVerified:false,persistenceVerified:false}
```

Use `gear.snapshot()` to inspect current native, hub and preview guard
ownership, independent readback statuses, outstanding requests, and the last
receipt. The module rejects wrong arch, unknown build, missing Lua stack,
native function mismatch, frame generation changes, queue collisions, stale
requests, and attempts to reuse an old preview hook after the native game
library base changes. `onLuaReset()` clears Lua/DDL/hub ownership flags but
keeps the **process-level** preview safety hook until `dispose()` reverts it.
New anonymous `mmap` buffers remain allocated because the original game may
retain their pointers; they are not freed on Lua reset.

## What original progress this actually establishes

The original Mac `fake_player_data.py` returns a `bound` array when native
void `bindStats()` calls were made. That is evidence of *invocation*, not of
valid DDL or on-disk progress. This module therefore has two distinct stages:
`PROFILE_NATIVE_BIND_INVOKED_NOT_DDL_PROVEN` and (only after new read-only
PDO/DDL probing) `ORIGINAL_DDL_READBACK_PRESENT_NOT_PERSISTED`.

The original hub's two successful `pcall()` results prove that a Lua
invocation completed, **not** that the menu rendered. A separately observed
`MobileMainMenuButtons` key and callable `LUI.FlowManager.RequestAddMenu`
only support `HUB_KEY_AND_FLOW_READBACK_NOT_UI_PROOF`. Similarly, original
`seed_all_loadouts.lua` can report group counts without all native DDL writes
actually succeeding; this module only reports
`FIFTEEN_LOCAL_CLASSES_READBACK_NOT_PERSISTED` after independent per-field
readback. Its `seedSyntheticProfile` uses the old `_WZM.pdo` global; that
global may be missing in a self-contained rootless process, in which case
the original Lua must fail rather than be marked as success.

**Critical missing native evidence** remains: a naturally connected original
frontend player/client, the real `CLIENT_CONNECT` fence rather than the
`offline_client_fence.lua` reported-ready shim, original weapon/operator
mesh/skin streaming, Gear Up widget render and Activity lifecycle stability,
real in-game equipment authority and persistent save/restore across process
restart. The previous `frontend_preview_guard.js` receipt with
`previewGuardBadOpcode` did not prove an installed owner; this port treats a
non-original opcode as an error, not proof another valid guard is running.
The catalog threshold `>=657` is the historical original catalog count,
but cannot by itself prove the registry was populated by a genuine callback
or that all referenced assets exist.

## Static verification

From `standalone_v4_ports_20261110/gear/`:

```sh
python3 generate_assets.py --verify
npm test
node --check gear_port.js
frida-compile gear_port.js -o /dev/null -T none -S
```

The initial isolated test suite passed **17/17** tests. Coverage includes:
exact source hashes/ELF fingerprints, bad build/opcode/frame, native
allocation and bind readback/partial errors, preview skip/delegate/revert,
original binary hub bytes, exact Lua stack-top restoration and
load/pcall ordering, independent hub/DDL/class readback, consent,
request deduplication, timeout, Lua generation reset, native library reload
and truthful unsupported editor action. All are Mac offline synthetic
results, not device gameplay verification.
