/*
 * WZM 4.5.2: isolated, NO-ADB autonomous boot fence supervisor.
 *
 * Exactly one readied native LUI frame Interceptor, never attached until at
 * least 15 seconds after Gadget rpc.exports.init. The original 5,233 byte
 * skip_online_fences.lua executes at most every tenth native UI frame, on
 * the ORIGINAL game's Lua thread. No host, bots, unlocks, or Gear Up here.
 *
 * Important: factory dependencies are injected to allow completely offline
 * Node mock verification. The Frida adapter in entry.js is the only module
 * allowed to access native process APIs directly. This does NOT prove an
 * actual unrooted phone can run the game or the Lua fence.
 */

export const MIN_NATIVE_DELAY_MS = 15000;
export const WZM_452_GUARDS = Object.freeze({
  moduleName: 'libgame.so',
  arch: 'arm64',
  // From the actual libgame.so AArch64 ET_DYN PT_LOAD virtual span.
  moduleSizeMin: 0x0de4a000,
  moduleSizeMax: 0x0de4d000,
  frame: 0x337c1c0,
  luaSlot: 0x54bcd08,
  luaLoad: 0x4490778,
  luaPcall: 0x4486bc4,
  luaToString: 0x4483720,
  // Exact unmodified file-backed code from signed WZM v4.5.2 libgame.so:
  // ELF SHA256 c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7
  // (not verified in-process: this is a static binary guard, not a hash of RAM).
  prologues: Object.freeze([
    {offset: 0x337c1c0, hex: 'eb2bb86de923016dfd7b02a9fc6f03a9'},
    {offset: 0x4490778, hex: 'ff0304d1fd7b0da9'},
    {offset: 0x4486bc4, hex: 'fd7bbea9f44f01a9'},
    {offset: 0x4483720, hex: 'fd7bbda9f50b00f9'}
  ])
});

export function createNativeBootSupervisor({
  runtime, fenceSource, fenceByteLength, notifyStage = () => {},
  notifyReady = () => {}, log = () => {}, startMs = 0,
  minDelayMs = MIN_NATIVE_DELAY_MS, guard = WZM_452_GUARDS,
  fingerprint = null, menuProbeSource = null,
  menuRecoveryProbeSource = null,
  onVerifiedLuiFrame = () => {}, onLuiReset = () => {},
  isNativeMatchPending = () => false,
  isNativeMatchObserved = () => false,
  notifyMatchUiContinuity = () => {}
}) {
  if (!runtime || typeof fenceSource !== 'string' || fenceByteLength < 1000)
    throw new Error('Native boot supervisor requires original embedded fence source and adapter');
  if (minDelayMs < MIN_NATIVE_DELAY_MS)
    throw new Error('Refusing native intercept before a 15-second grace period');

  let stage = 'WAIT_15S';
  let ready = false;
  let installed = false;
  let terminated = false;
  let hook = null;
  let native = null;
  let frames = 0;
  let attempts = 0;
  let successes = 0;
  let activeLui = null;
  let inFrame = false;
  let firstFrameMs = null;
  let lastFrameMs = null;
  let lastError = null;
  let everMenuReady = false;
  let matchUiContinuity = false;

  function updateStage(next) {
    if (stage === next || terminated) return;
    stage = next;
    notifyStage(next);
    log('Native boot stage: ' + next);
  }

  function setReady(value) {
    const next = Boolean(value);
    if (ready === next || terminated) return;
    ready = next;
    notifyReady(next);
  }

  function setMatchUiContinuity(value) {
    const next = Boolean(value);
    if (matchUiContinuity === next || terminated) return;
    matchUiContinuity = next;
    // A previously verified MainMenu may retain its floating control during
    // native match VM changes. This is visibility only: it never grants menu
    // readiness, native match capability, or gear/unlock permission.
    notifyMatchUiContinuity(next);
  }

  function isProvenMatchContinuation() {
    return everMenuReady && (isNativeMatchPending() || isNativeMatchObserved());
  }

  function safeFailure(reason) {
    lastError = String(reason).slice(0, 200);
    setMatchUiContinuity(false);
    setReady(false);
    updateStage('NATIVE_UNSUPPORTED');
    log('Passive/native fence setup refused: ' + lastError);
  }

  function visibleMemory(address, bytes, flag) {
    if (address === null || address.isNull()) return false;
    const range = runtime.range(address);
    if (!range || !range.protection.includes('r') ||
        (flag && !range.protection.includes(flag))) return false;
    return address.add(bytes).compare(range.base.add(range.size)) <= 0;
  }

  function checkBuild(mod) {
    if (runtime.arch() !== guard.arch) return 'UNSUPPORTED_ARCH';
    if (!mod || mod.name !== guard.moduleName ||
        mod.size < guard.moduleSizeMin || mod.size > guard.moduleSizeMax)
      return 'UNSUPPORTED_GAME_SIZE';
    for (const {offset, hex} of guard.prologues) {
      const p = mod.base.add(offset);
      if (!visibleMemory(p, hex.length / 2, 'x')) return 'PROLOGUE_NOT_EXECUTABLE_' + offset.toString(16);
      const actual = runtime.hexBytes(p, hex.length / 2).toLowerCase();
      if (actual !== hex) return 'PROLOGUE_MISMATCH_' + offset.toString(16);
    }
    // The relocated slot is read-only on Android. Only the Lua stack is written.
    if (!visibleMemory(mod.base.add(guard.luaSlot), 8, null)) return 'LUA_SLOT_NOT_READABLE';
    // The original worker18 source-port pins the GNU ELF build ID and four
    // independent +0x20 code windows, so an unrelated libgame.so cannot pass
    // simply by sharing the basic function prologues.
    if (fingerprint !== null) {
      if (fingerprint.game_version !== '4.5.2.22729281' ||
          mod.size < fingerprint.elf_mapped_min_bytes ||
          mod.size > fingerprint.elf_mapped_page_bytes)
        return 'ORIGINAL_ELF_MAPPING_MISMATCH';
      const idPointer = mod.base.add(fingerprint.gnu_build_id_rva);
      if (!visibleMemory(idPointer, fingerprint.gnu_build_id_length, 'r') ||
          runtime.hexBytes(idPointer, fingerprint.gnu_build_id_length).toLowerCase() !==
            fingerprint.gnu_build_id_hex) return 'GNU_BUILD_ID_MISMATCH';
      for (const window of fingerprint.code_windows) {
        const address = mod.base.add(window.rva);
        if (!visibleMemory(address, window.bytes_hex.length / 2, 'x') ||
            runtime.hexBytes(address, window.bytes_hex.length / 2).toLowerCase() !==
              window.bytes_hex) return 'ORIGINAL_CODE_WINDOW_MISMATCH_' + window.name;
      }
    }
    return null;
  }

  function resetLui() {
    activeLui = null;
    setMatchUiContinuity(isProvenMatchContinuation());
    setReady(false);
    updateStage('WAIT_LUI_STATE');
    try { onLuiReset(); } catch (e) { log('Lua generation reset callback: ' + e); }
  }

  function runChunk(L, buffer, byteLength) {
    const topAddress = L.add(0x28);
    const top = runtime.readPointer(topAddress);
    if (top.isNull() || !visibleMemory(top, 1, null))
      return {ok: false, error: 'UNREADABLE_LUA_STACK'};
    let loadCode = -1, pcallCode = -1, text = '';
    try {
      loadCode = native.load(L, buffer, byteLength, native.chunkName,
                             runtime.nullPointer());
      if (loadCode === 0) pcallCode = native.pcall(L, 0, 1, 0);
      const resultPtr = native.toString(L, -1, runtime.nullPointer());
      if (resultPtr && !resultPtr.isNull()) text = runtime.readUtf8(resultPtr, 256);
    } finally {
      runtime.writePointer(topAddress, top);
    }
    return {ok: loadCode === 0 && pcallCode === 0, loadCode, pcallCode, text};
  }

  function onNativeFrame() {
    if (terminated || !native || inFrame) return;
    if (firstFrameMs === null) firstFrameMs = runtime.now();
    lastFrameMs = runtime.now();
    frames++;
    if (frames % 10 !== 0) return;
    inFrame = true;
    try {
      // The first slot is *pointer to* the holder of the Lua state pointer.
      const ptrHolder = runtime.readPointer(native.luaSlot);
      if (!visibleMemory(ptrHolder, 8, null)) {
        if (activeLui !== null) resetLui();
        else updateStage('WAIT_LUI_STATE');
        return;
      }
      const L = runtime.readPointer(ptrHolder);
      if (!visibleMemory(L, 0x30, 'w')) {
        if (activeLui !== null) resetLui();
        else updateStage('WAIT_LUI_STATE');
        return;
      }
      const identity = String(ptrHolder) + '/' + String(L);
      if (identity !== activeLui) {
        // LUI VM reconstruction invalidates old global _WZM hooks: re-arm.
        try { onLuiReset(); } catch (e) { log('Lua generation changed callback: ' + e); }
        activeLui = identity;
        setMatchUiContinuity(isProvenMatchContinuation());
        setReady(false);
        updateStage('FENCE_PENDING');
      }

      const topAddress = L.add(0x28);
      const oldTop = runtime.readPointer(topAddress);
      if (oldTop.isNull() || !visibleMemory(oldTop, 1, null)) {
        updateStage('WAIT_LUI_STACK');
        return;
      }
      // Once the original MainMenu/Play presence has been proven, the
      // original host transitions into an in-game LUI that may rebuild its
      // Lua VM and no longer has a MainMenu Play control. Party injector
      // and host probes MUST keep receiving the SAME frame-owner callback,
      // without re-running menu-only fence Lua while the world is loading.
      // Never allow this continuation before the first genuine menu proof.
      if (everMenuReady && isNativeMatchPending()) {
        setMatchUiContinuity(true);
        updateStage('IN_MATCH_NATIVE_LUI_FRAME');
        try {
          onVerifiedLuiFrame({L,native,runtime,moduleBase:native.moduleBase,
            identity,menuReady:false});
        } catch (e) { log('In-game original frame callback failed: ' + e); }
        return;
      }
      // After the first authentic MainMenu proof, inspect the actual original
      // Play-button widget BEFORE invoking the menu-only fence. This read-only
      // probe does not depend on _WZM.play (which a rebuilt VM has lost).
      // NATIVE_AI_OBSERVED is a terminal observation, not a perpetually pending
      // host stage: it must allow this menu recovery probe to run.
      if (everMenuReady && menuRecoveryProbeSource !== null) {
        const recovered = runChunk(L, native.menuRecoveryProbeBuffer,
                                   native.menuRecoveryProbeByteLength);
        if (!recovered.ok || recovered.text !== 'MAINMENU_PLAY_PRESENT') {
          if (isNativeMatchObserved()) {
            setMatchUiContinuity(true);
            updateStage('IN_MATCH_NATIVE_LUI_FRAME');
            try {
              onVerifiedLuiFrame({L,native,runtime,moduleBase:native.moduleBase,
                identity,menuReady:false});
            } catch (e) { log('Observed match frame callback failed: ' + e); }
          } else {
            // Once native match setup has failed or ended without an observed
            // in-game continuation, an unverified menu cannot retain controls.
            setMatchUiContinuity(false);
            updateStage(ready ? 'LUI_ACTIVE_OUTSIDE_MAINMENU' :
              'WAIT_MAINMENU_PLAY_BUTTON');
            if (ready) {
              try {
                onVerifiedLuiFrame({L,native,runtime,
                  moduleBase:native.moduleBase,identity,menuReady:false});
              } catch (e) { log('Post-menu original LUI callback: ' + e); }
            }
          }
          return;
        }
      }
      attempts++;
      let loadResult = -1;
      let pcallResult = -1;
      let result = '';
      try {
        loadResult = native.load(L, native.fenceBuffer, fenceByteLength,
                                 native.chunkName, runtime.nullPointer());
        if (loadResult === 0)
          pcallResult = native.pcall(L, 0, 1, 0);
        const resultPtr = native.toString(L, -1, runtime.nullPointer());
        if (resultPtr && !resultPtr.isNull())
          result = runtime.readUtf8(resultPtr, 256);
      } finally {
        // Lua VM stack MUST be restored even on load errors and exceptions.
        runtime.writePointer(topAddress, oldTop);
      }

      if (loadResult !== 0 || pcallResult !== 0 || result.startsWith('play button error:')) {
        if (attempts <= 3 || attempts % 60 === 0)
          log('Lua fence pending: load=' + loadResult + ' pcall=' + pcallResult + ' ' + result);
        updateStage('WAIT_FENCE_LUA');
        return;
      }
      successes++;
      if (menuProbeSource !== null) {
        const menu = runChunk(L, native.menuProbeBuffer, native.menuProbeByteLength);
        if (!menu.ok || menu.text !== 'MAINMENU_READY') {
          // Once the genuine menu was verified, leaving it for a native
          // match must NOT suspend the ONE owned LUI-frame callback. Party
          // injection and original host probes require that same callback
          // even when the Play-button menu has gone away. Before the first
          // authentic MainMenu probe, never invoke any post-ready actions.
          if (ready) {
            updateStage('LUI_ACTIVE_OUTSIDE_MAINMENU');
            try {
              onVerifiedLuiFrame({L, native, runtime,
                moduleBase:native.moduleBase,identity,menuReady:false});
            } catch (e) { log('Post-menu original LUI callback: ' + e); }
          } else updateStage('WAIT_MAINMENU_PLAY_BUTTON');
          return;
        }
      }
      if (menuProbeSource !== null) everMenuReady = true;
      // Success here means original source completed on a genuine LUI frame.
      // With menuProbeSource present, the original Play UI was also observed.
      // This still does NOT prove real account login, unlocks or native host.
      updateStage(menuProbeSource !== null ? 'MAINMENU_FENCE_READY' : 'FENCE_LUA_EXECUTED');
      if (!ready) {
        setReady(true);
        log('Original fence Lua ran on native LUI frame (no host/unlocks): ' + result);
      }
      setMatchUiContinuity(false);
      try {
        // Unlock actions use this same frame owner. They must never install
        // their own Interceptor or invoke Android Java on the native thread.
        onVerifiedLuiFrame({L, native, runtime, moduleBase: native.moduleBase,
          identity, menuReady:true});
      } catch (e) { log('Unlock queue frame failure (fence retained): ' + e); }
    } catch (e) {
      lastError = String(e).slice(0, 180);
      if (attempts <= 3 || attempts % 60 === 0)
        log('Lua frame attempt deferred: ' + lastError);
      updateStage('WAIT_FENCE_LUA');
    } finally {
      inFrame = false;
    }
  }

  function tick() {
    if (terminated || stage === 'NATIVE_UNSUPPORTED') return;
    if (runtime.now() - startMs < minDelayMs) return;
    if (installed) {
      if (lastFrameMs !== null && runtime.now() - lastFrameMs > 30000) {
        setMatchUiContinuity(false);
        setReady(false);
        updateStage('WAIT_LUI_FRAME');
      }
      return;
    }
    let mod;
    try {
      mod = runtime.findModule(guard.moduleName);
    } catch (e) {
      updateStage('WAIT_LIBGAME');
      return;
    }
    if (!mod) { updateStage('WAIT_LIBGAME'); return; }

    try {
      const error = checkBuild(mod);
      if (error !== null) { safeFailure(error); return; }
      const base = mod.base;
      // NativeFunction bindings are assembled only AFTER guards pass.
      const functions = runtime.createBindings({
        load: base.add(guard.luaLoad),
        pcall: base.add(guard.luaPcall),
        toString: base.add(guard.luaToString),
        source: fenceSource,
        sourceByteLength: fenceByteLength,
        menuProbeSource,
        menuRecoveryProbeSource
      });
      native = {...functions, luaSlot: base.add(guard.luaSlot), moduleBase: base};
      hook = runtime.attach(base.add(guard.frame), onNativeFrame);
      installed = true;
      updateStage('WAIT_LUI_FRAME');
      log('One protected LUI-frame hook installed after >=15s; no game host or bots');
    } catch (e) {
      // One failure is a hard stop: never repeatedly attach to unknown native code.
      safeFailure(e);
    }
  }

  function dispose() {
    if (terminated) return;
    setMatchUiContinuity(false);
    setReady(false);
    terminated = true;
    stage = 'DISPOSED';
    if (hook !== null) {
      try { hook.detach(); } catch (e) { log('Native hook detach: ' + e); }
      hook = null;
    }
    native = null;
  }

  function snapshot() {
    return {
      bootStage: stage, nativeReady: ready, matchUiContinuity, installed, frames, attempts,
      successes, firstFrameMs, lastFrameMs, error: lastError
    };
  }

  return {tick, dispose, snapshot, onNativeFrame};
}
