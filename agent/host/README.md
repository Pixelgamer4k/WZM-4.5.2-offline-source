# Original WZM 4.5.2 native host adapter — V4, source-only

**MAC STATIC-TESTED, NOT PLAYABLE OR ROOTLESS-DEVICE-VERIFIED.** These are new,
isolated files. No original phone, ADB, root, install, original signed APK,
`standalone_combined_v3`, Mac TUI source or prior host port was touched.

This is a **real executable in-process adapter** for the original
`host_spawn.js`, rather than a stub that accepts UI values. It deliberately
requires exact native ELF and readiness proofs, an actual native-match clock
setter, the original host functions, observed server-client progression, and
native marker-2 AI/team/difficulty readback before reporting those stages. It
will **refuse dispatch** without a verified duration implementation. Existing
`host_spawn.py` only uses its `seconds` argument for a Python watchdog;
**that is not a game-engine match timer**, and is not faked here.

## Files

| File | Purpose |
|---|---|
| `generate_embedded.py` | SHA-pinned source generator, with read-only `--verify` |
| `embedded_sources.js` | Runtime filesystem-free host (~110 KB), native AI creator and persistent difficulty guard |
| `match_contract.js` | Byte-exact original TUI eight-map/six-mode configuration validator |
| `native_proof.js` | Read-only original ARM64 ELF build ID, fourteen native opcode/window checks, server veneer guards and `Script.evaluate` adapter |
| `host_adapter.js` | Explicit-click, one-shot host source loading, native clock readback, original `go`, server/world and real bot lifecycle |
| `test_host_adapter.mjs`, `test_native_proof.mjs` | Offline mocked native-edge tests; they never load original host side effects |

### Provenance and generated-source changes

The generator refuses changed authoritative inputs and embeds the actual source
bytes as static JavaScript strings. The following SHA-256s are pinned:

- Original `WarzoneMobileOffline/.../host_spawn.js`:
  `cab61ad012edfd814f17c25866b26cc9a77fe221320f873ccee315acde58519d`
- Previously reviewed `standalone_host_port_20261110/host_gadget_function.js`:
  `58f2055121216d56e1d555ead15f828e2f11283c30a767e372509d46d3ca3bde`
- Original `native_ai_both_sides.js`:
  `c27fc54c334cc17c450a71d1eeea4abf432c40c28bf534407ca26cd402ff2c40`
- Original `native_ai_veteran_guard.js`:
  `b63c44c77f03041f661046f95610b4022d3c71fbac8aced6ab7e8b3a2b3a2225`
- Original `match_contract.js`:
  `ae16d6f9ea173af64c719a9eaf6b59dc5eac6285399370b5b980d0e970f8e27f`

The host function has its **two extra** `libgame.so+0x337c1c0` LUI
Interceptors removed: the read-only frame witness was dropped, and the original
Lua match probe was converted into
`globalThis.WZM_HOST_MATCH_PROBE_FRAME()`. Call that function ONLY through
`port.onLuiFrame()` from the pre-existing Gadget-owned native LUI callback.
This preserves the original probe but prevents competing frame owners.

The original marker-2 AI script calls original native setter `0x265ea3c`
with the selected difficulty `0..3` instead of always forcing Veteran `3`,
and checks the byte readback against that exact choice. The retained native
AI difficulty guard accepts the same `WZM_BOT_DIFF`, and its feedback labels
are corrected. The bot creator is armed with **enemies + friends** while
the host's original `ENEMY_AI_RT` assigns the first N genuine marker-2 bots
team 1 and the remainder team 2; team and marker readbacks must match.
No synthetic clients or fake bot-completion acknowledgements are generated.

## Exact integration API for prime (DO NOT AUTO-LOAD)

In v4 Gadget `entry.js`, **after its existing single LUI supervisor is set up**:

```js
import {createInProcessHostAdapter} from './host/host_adapter.js';
import {createFridaHostRuntime} from './host/native_proof.js';

let nativeHostOwner; // Keep private in native supervisor, not UI/broadcast/RPC.
const port = createInProcessHostAdapter({
  runtime: createFridaHostRuntime(),
  nativeClock: VERIFIED_NATIVE_GAME_CLOCK_DRIVER,
  bindNativeOwner: (owner) => { nativeHostOwner = owner; },
  notify: (event) => log(JSON.stringify(event)),
});

// Call ONLY from independent, checked original native callbacks/readback:
nativeHostOwner.mark('MAINMENU_LUI_VERIFIED', true,
  {verified:true,source:'native-readback'});
// The exact same evidence pattern applies to real DDL, loadout, party,
// AI-path, clock readiness and map-specific asset/zone stages.

// On an explicit *user* Match click, and not during app initialization:
if (port.configure(validatedMatchRequest) === true) {
  const accepted = port.go(validatedMatchRequest.nativeMapId,
    validatedMatchRequest.nativeModeHash,
    validatedMatchRequest.enemyBots);
  // accepted===1 means original host request QUEUED, NOT started/playable.
}

// Existing native-boot LUI callback (native thread, already registered):
port.onLuiFrame();

// Existing Gadget JS loop/tick, outside all native callbacks:
port.poll();
// `port.snapshot()` returns real stage receipts with matchStarted:false.
```

**Never create the native capability owner by exposing `.mark()` in UI, IPC,
or `rpc.exports`.** The returned `port` object contains no mutable verifier.
`mark()` requires a native-readback-shaped receipt, but that receipt is not
cryptographic attestation: only the actual native owner can validate it.

### Required `nativeClock` driver contract

This **is not implemented in the original host or the original Python runner**.
The adapter checks for all four functions and refuses to call `Script.evaluate`
if any are absent or unverified. A future source-backed driver must set the
**game's own native match duration and termination route**, not merely a
JavaScript elapsed-time counter:

```js
const nativeClock = {
  configure(durationSeconds, exactHostBinaryEvidence) {
    // Verify native clock function/code, set actual match limit, read it back.
    return true; // ONLY if actual verified native operation succeeded.
  },
  readback() {
    return {verifiedNativeGameClock:true, seconds:ACTUAL_NATIVE_READBACK_SECONDS};
  },
  begin(durationSeconds, {worldStartAt, hostSnapshot}) {
    // Start native match clock after original clc0 reaches >=7; verify.
    return true; // ONLY if native timer started, not a JS timeout.
  },
  endReadback() {
    return {verifiedNativeEnd:ACTUAL_NATIVE_MATCH_END_OBSERVED};
  },
};
```

The above is an **interface example**, not a provided working native driver.
Until a source-confirmed native time-limit and match-end route are found and
verified, `port.preflight(...)` returns `HOST_REAL_NATIVE_DURATION_UNAVAILABLE`
and `port.configure()` returns `false` — including for a selected 60 minutes.
Do not hide that blocker or downgrade to an inert JS countdown.

### Pre-launch vs post-launch capabilities

Privately verified pre-launch stages are:

`MAINMENU_LUI_VERIFIED`, `LOCAL_DDL_PROFILE_BOUND`,
`LOADOUTS_READBACK_VERIFIED`, `HOST_PARTY_PRECONDITIONS_VERIFIED`,
`NATIVE_AI_CREATOR_READY`, `NATIVE_MATCH_CLOCK_READY`, plus required Verdansk
or Broadcast asset/zone stages. The adapter checks exact libgame.so build ID,
mapped size and original native instruction windows independently every time.

**Do not require `WORLD_PLAYER_SPAWN_VERIFIED` or `NATIVE_MARKER2_AI_VERIFIED`
before dispatch**: those events cannot exist until the original host is
requested and the client enters the world. The v3 match gate's old pre-launch
requirements must be split into pre-launch and post-launch validation in v4.

On `go`, the pinned original 110 KB host source is evaluated **once** through
Frida 17 `Script.evaluate` (not `Script.load` on arbitrary user-supplied JS).
Its real original `rpc.go(map,mode,enemies)` queues a host manager request.
Observed `hostStartReturned` is not enough to claim that a world exists. The
original `clientEnterWorld` event fires on **entry state 6** (observed in
original host logs), so it is only a candidate. On a subsequent JS tick,
`host.snap().clc0 >= 7` must confirm the client reached world-state 7 before
the native clock is started and the original AI script is loaded. The real
server-call veneer at `0x3cd7b20` must contain the original AArch64 thunk
instructions and a valid executable target before AI is armed. Once real
marker-2 bots enter state 7, the native team counts and original difficulty
setter readback must match; the persistent guard then keeps difficulty set.

Original host hooks are invasive (`Interceptor.replaceFast`, VM53 flow, CModule,
network/packet patches). They do **not** have a verified full rollback. The
adapter refuses retries or a second evaluation after partial installation,
even if LUI resets. A game process restart, not a second `go`, is necessary
after a failed one-shot host load. Keep its source **off** before explicit
Match action.

## Source-only verification

```sh
cd ~/Desktop/Projects/WZM452_Rootless_Gadget_Overlay_POC
python3 standalone_v4_ports_20261110/host/generate_embedded.py --verify
node standalone_v4_ports_20261110/host/test_native_proof.mjs
node standalone_v4_ports_20261110/host/test_host_adapter.mjs
node --check standalone_v4_ports_20261110/host/host_adapter.js
node --check standalone_v4_ports_20261110/host/native_proof.js
```

## Remaining genuine blockers

The rootless host has **not** been loaded on an actual phone. Unported or
unverified prerequisites include original DDL/profile initialization and
saved user loadouts; VM53 protected host initialization and client packet
routing; native match clock and end-match readback; complete party-inject
sequencing, robust AI creator/guard lifecycle; Verdansk/Broadcast pack/zone
registration; weapon equip persistence; and real world/player weapons,
damage, respawn, AI behavior and match completion. `clientEnterWorld`,
`botInjectFinal` and `hostStartReturned` logs do **not** establish playable AI.

**This is an actual guarded host/AI port and source-backed test implementation,
not a proven playable standalone APK.**
