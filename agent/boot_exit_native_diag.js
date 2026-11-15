/*
 * Isolated WZM 4.5.2 V8 native boot-exit tracer.
 *
 * Observation only. Never replaces a return value, prevents task removal,
 * writes memory, modifies libgame, controls exit behavior or claims gameplay
 * readiness. Designed for injection by the prime-owned Frida agent.
 *
 * Frida dependencies (including Java and the v7 pinned GAME_FINGERPRINT)
 * are injected by the caller. This module has no side effects on import.
 */

export const MAX_NATIVE_FRAMES = 64;
export const DEFAULT_NATIVE_FRAMES = 24;
export const MAX_EXIT_EVENTS = 12;
export const MAX_LOG_CHARS = 6500;
export const MAX_LOG_CHUNK_CHARS = 2750;

const GAME_PACKAGE = 'com.activision.callofduty.warzone';
const GAME_ACTIVITY = 'com.activision.game.MainActivity';
const LIBGAME = 'libgame.so';
const DIAG_TAG = 'WZM_NATIVE_EXIT';

function safeText(value, limit = 100) {
  try { return String(value).slice(0, limit).replace(/[\r\n\t]/g, ' '); }
  catch (_) { return '<unprintable>'; }
}

function safePointerText(value) {
  const text = safeText(value, 36);
  return /^0x[0-9a-f]+$/i.test(text) ? text.toLowerCase() : '<invalid-pc>';
}

function pointerBigInt(value) {
  const text = safePointerText(value);
  if (text === '<invalid-pc>') return null;
  try { return BigInt(text); } catch (_) { return null; }
}

function boundedCount(n, fallback, ceiling) {
  return Number.isInteger(n) && n > 0 ? Math.min(n, ceiling) : fallback;
}

function byteHex(address, count) {
  const bytes = new Uint8Array(address.readByteArray(count));
  if (bytes.length !== count) throw new Error('short memory read');
  let result = '';
  for (const byte of bytes) result += byte.toString(16).padStart(2, '0');
  return result;
}

/**
 * Read-only source-backed libgame fingerprint check. The source SHA256 is a
 * provenance pin for the archived original libgame file, NOT a live RAM hash.
 * We only label the runtime as matching after checking module size, GNU
 * build-id and *every* pinned code window from the supplied fingerprint.
 */
export function inspectLibgameFingerprint(Process, fingerprint) {
  const report = {
    name: LIBGAME,
    proof: 'UNVERIFIED',
    reason: 'NOT_CHECKED',
    buildId: null,
    sourceGameSha256: null,
    version: null
  };
  if (!Process || typeof Process.findModuleByName !== 'function') {
    report.reason = 'MODULE_LOOKUP_UNAVAILABLE';
    return report;
  }
  let module;
  try { module = Process.findModuleByName(LIBGAME); }
  catch (_) { report.reason = 'MODULE_LOOKUP_FAILED'; return report; }
  if (!module) { report.reason = 'LIBGAME_NOT_LOADED'; return report; }
  if (!fingerprint || fingerprint.library !== LIBGAME ||
      fingerprint.game_version !== '4.5.2.22729281' ||
      !Number.isInteger(fingerprint.elf_mapped_min_bytes) ||
      !Number.isInteger(fingerprint.elf_mapped_page_bytes) ||
      !Number.isInteger(fingerprint.gnu_build_id_rva) ||
      !Number.isInteger(fingerprint.gnu_build_id_length) ||
      fingerprint.gnu_build_id_length < 1 ||
      fingerprint.gnu_build_id_length > 32 ||
      !/^[0-9a-f]{32,64}$/i.test(fingerprint.gnu_build_id_hex || '') ||
      !Array.isArray(fingerprint.code_windows) ||
      fingerprint.code_windows.length !== 4) {
    report.reason = 'SOURCE_FINGERPRINT_MISSING_OR_UNSUPPORTED';
    return report;
  }
  report.sourceGameSha256 = safeText(fingerprint.input_libgame_sha256, 64);
  report.version = fingerprint.game_version;
  const size = module.size;
  if (!Number.isInteger(size) ||
      size < fingerprint.elf_mapped_min_bytes ||
      size > fingerprint.elf_mapped_page_bytes) {
    report.reason = 'MODULE_SIZE_MISMATCH';
    return report;
  }
  try {
    const id = byteHex(module.base.add(fingerprint.gnu_build_id_rva),
                       fingerprint.gnu_build_id_length);
    report.buildId = id;
    if (id !== fingerprint.gnu_build_id_hex.toLowerCase()) {
      report.reason = 'GNU_BUILD_ID_MISMATCH';
      return report;
    }
    for (const window of fingerprint.code_windows) {
      if (!Number.isInteger(window.rva) ||
          window.rva < 0 || window.rva >= size ||
          typeof window.bytes_hex !== 'string' ||
          !/^[0-9a-f]+$/i.test(window.bytes_hex) ||
          window.bytes_hex.length < 2 ||
          window.bytes_hex.length > 128 ||
          window.bytes_hex.length % 2 !== 0 ||
          window.rva + window.bytes_hex.length / 2 > size) {
        report.reason = 'PINNED_CODE_WINDOW_INVALID';
        return report;
      }
      const got = byteHex(module.base.add(window.rva), window.bytes_hex.length / 2);
      if (got !== window.bytes_hex.toLowerCase()) {
        report.reason = 'PINNED_CODE_WINDOW_MISMATCH';
        return report;
      }
    }
  } catch (_) {
    report.reason = 'FINGERPRINT_MEMORY_UNREADABLE';
    return report;
  }
  report.proof = 'SOURCE_BACKED_MATCH';
  report.reason = 'GNU_ID_AND_4_CODE_WINDOWS_MATCH';
  return report;
}

function formatFrame(pc, Process, i) {
  const text = safePointerText(pc);
  let module = null;
  try {
    if (Process && typeof Process.findModuleByAddress === 'function')
      module = Process.findModuleByAddress(pc);
  } catch (_) { /* keep frame without a module */ }
  if (!module) return '#' + i + ' <unmapped> ' + text;
  const moduleName = safeText(module.name || '<unknown-module>', 48)
    .replace(/[^A-Za-z0-9_.+-]/g, '_');
  const address = pointerBigInt(pc);
  const base = pointerBigInt(module.base);
  if (address === null || base === null || address < base) {
    return '#' + i + ' ' + moduleName + '+<unknown-rva> ' + text;
  }
  const rva = address - base;
  // RVA is virtual module-relative offset, not an on-disk ELF file offset.
  if (!Number.isSafeInteger(module.size) || rva >= BigInt(module.size))
    return '#' + i + ' ' + moduleName + '+<outside-mapping> ' + text;
  return '#' + i + ' ' + moduleName + '+0x' + rva.toString(16);
}

/**
 * Native backtrace from the CURRENT hooked Java thread. It cannot recover a
 * historical async caller; the Java-to-native bridge can also omit the game's
 * initiating frame. ACCURATE is preferred; FUZZY is attempted on error/empty.
 * Never call DebugSymbol.fromAddress or enumerate threads/modules in a loop.
 */
export function sampleNativeBacktrace({Thread, Backtracer, Process, fingerprint,
                                       maxFrames = DEFAULT_NATIVE_FRAMES} = {}) {
  const limit = boundedCount(maxFrames, DEFAULT_NATIVE_FRAMES, MAX_NATIVE_FRAMES);
  const identity = inspectLibgameFingerprint(Process, fingerprint);
  const result = {identity, frames: [], mode: 'UNAVAILABLE', error: null};
  if (!Thread || typeof Thread.backtrace !== 'function' || !Backtracer) {
    result.error = 'BACKTRACE_API_UNAVAILABLE';
    return result;
  }
  for (const kind of ['ACCURATE', 'FUZZY']) {
    try {
      if (!Backtracer[kind]) continue;
      // In a Java overload hook there is no Frida Interceptor CPU context.
      const stack = Thread.backtrace(undefined, Backtracer[kind]);
      if (!Array.isArray(stack) || stack.length === 0) continue;
      result.mode = kind;
      for (let i = 0; i < stack.length && result.frames.length < limit; i++) {
        try { result.frames.push(formatFrame(stack[i], Process, i)); }
        catch (_) { result.frames.push('#' + i + ' <frame-unavailable>'); }
      }
      break;
    } catch (_) { /* try alternative unwinder */ }
  }
  if (result.frames.length === 0) result.error = 'NATIVE_BACKTRACE_UNAVAILABLE';
  return result;
}

function readReadySnapshot(readiness) {
  if (typeof readiness !== 'function') return 'not-provided';
  try {
    const snapshot = readiness();
    if (!snapshot || typeof snapshot !== 'object') return 'unavailable';
    const phase = safeText(snapshot.bootStage ?? 'unknown', 36);
    const match = safeText(snapshot.matchPhase ?? 'unknown', 36);
    // Explicitly sourced from the prime-owned state callback; not independently
    // validated evidence of a world, match, player or screen being ready.
    const ready = snapshot.nativeReady === true ? 'reported-true' :
                  snapshot.nativeReady === false ? 'reported-false' : 'unknown';
    return 'boot=' + phase + ',nativeReady=' + ready + ',match=' + match;
  } catch (_) { return 'unavailable'; }
}

function traceLines(event, sample, readiness) {
  const id = sample.identity;
  return [
    'event=' + safeText(event, 90) + ' native-mode=' + sample.mode +
      ' frames=' + sample.frames.length + ' (max ' + MAX_NATIVE_FRAMES + ')',
    'libgame=' + id.proof + ' reason=' + id.reason +
      ' buildId=' + (id.buildId || '-') +
      ' source-game-sha256=' + (id.sourceGameSha256 || '-') +
      ' source-version=' + (id.version || '-'),
    'readiness-observed=' + readReadySnapshot(readiness) +
      ' [state callback only; gameplay NOT verified]',
    ...(sample.error ? ['native-warning=' + sample.error] : []),
    ...sample.frames
  ];
}

function emitBoundedLines(log, event, lines) {
  let total = 0;
  let chunk = '';
  let part = 0;
  for (let line of lines) {
    line = safeText(line, 240);
    if (total + line.length + 1 > MAX_LOG_CHARS) {
      line = '[TRUNCATED: bounded native diagnostics]';
      if (total + line.length + 1 > MAX_LOG_CHARS) break;
    }
    if (chunk.length + line.length + 1 > MAX_LOG_CHUNK_CHARS && chunk) {
      try { log('[' + safeText(event, 45) + ' part ' + (++part) + ']\n' + chunk); }
      catch (_) { /* logging cannot alter game shutdown */ }
      chunk = '';
    }
    chunk += line + '\n';
    total += line.length + 1;
    if (line.startsWith('[TRUNCATED:')) break;
  }
  if (chunk) {
    try { log('[' + safeText(event, 45) + ' part ' + (++part) + ']\n' + chunk); }
    catch (_) { /* fail closed */ }
  }
}

/**
 * @param {object} options
 * @param {object} options.Java Frida Java bridge from prime's entry agent.
 * @param {object} options.Thread Frida Thread API.
 * @param {object} options.Backtracer Frida Backtracer constants.
 * @param {object} options.Process Frida Process API.
 * @param {object} options.fingerprint Original v7 GAME_FINGERPRINT object.
 * @param {function} [options.readiness] Optional passive current-state callback.
 * @param {number} [options.maxFrames=24] Per event, clamped to 64.
 * @param {number} [options.maxEvents=12] Total events, clamped to 24.
 * @param {function} [options.log] Optional log function (for offline tests).
 *
 * @returns {{arm: function, snapshot: function}} Reuse the returned handle,
 * never install this alongside the older v7 boot_exit_trace hooks.
 */
export function createBootExitNativeDiagnostic({
  Java, Thread, Backtracer, Process, fingerprint,
  readiness = null, maxFrames = DEFAULT_NATIVE_FRAMES,
  maxEvents = MAX_EXIT_EVENTS, log = null
} = {}) {
  const limit = boundedCount(maxFrames, DEFAULT_NATIVE_FRAMES, MAX_NATIVE_FRAMES);
  const budget = boundedCount(maxEvents, MAX_EXIT_EVENTS, 24);
  let status = 'UNARMED';
  let queued = false;
  let installed = 0;
  let emitted = 0;

  function statusSnapshot() {
    return {status, queued, installedHooks: installed, emittedEvents: emitted,
            maxEvents: budget, maxFrames: limit};
  }

  function arm() {
    if (queued || status === 'ARMED') return statusSnapshot();
    if (!Java || !Java.available || typeof Java.perform !== 'function' ||
        !Process || !Thread || !Backtracer) {
      status = 'UNAVAILABLE';
      return statusSnapshot();
    }
    queued = true;
    status = 'SCHEDULED';
    try {
      Java.perform(() => {
        queued = false;
        if (status === 'ARMED') return;
        let androidLog = null;
        try { androidLog = Java.use('android.util.Log'); }
        catch (_) { /* optional, provided logger may still be used */ }
        const writer = typeof log === 'function' ? log : (msg) => {
          try {
            if (androidLog && typeof androidLog.w === 'function')
              androidLog.w(DIAG_TAG, msg);
          } catch (_) { /* logging never changes control flow */ }
        };
        function note(msg) {
          try { writer(safeText(msg, 220)); } catch (_) {}
        }
        function record(event) {
          if (emitted >= budget) return;
          emitted++;
          try {
            const native = sampleNativeBacktrace({
              Thread, Backtracer, Process, fingerprint, maxFrames: limit
            });
            emitBoundedLines(writer, event, traceLines(event, native, readiness));
          } catch (_) { note('event=' + event + ' native diagnostic unavailable'); }
        }
        const isGame = (activity) => {
          try { return safeText(activity.getPackageName(), 140) === GAME_PACKAGE; }
          catch (_) { return false; }
        };
        function hook(clazz, methodName, label, filter) {
          try {
            const field = clazz[methodName];
            if (!field || typeof field.overload !== 'function') return false;
            const original = field.overload();
            original.implementation = function (...args) {
              try { if (!filter || filter(this)) record(label); }
              catch (_) { /* observer must never affect the original call */ }
              // No modified args or return, no bypass, no call to finish
              // elsewhere. Preserve any exception the original itself throws.
              return original.call(this, ...args);
            };
            installed++;
            return true;
          } catch (_) { return false; }
        }
        try {
          const Activity = Java.use('android.app.Activity');
          for (const name of [
            'finish', 'finishAffinity', 'finishAndRemoveTask', 'finishAfterTransition'
          ]) hook(Activity, name, 'Activity.' + name, isGame);
          hook(Activity, 'onDestroy', 'Activity.onDestroy', isGame);
        } catch (_) { note('android.app.Activity hooks unavailable'); }
        // Only hook concrete MainActivity.onDestroy when that override is
        // DECLARED, rather than inheriting Activity.onDestroy a second time.
        try {
          const MainActivity = Java.use(GAME_ACTIVITY);
          const methods = MainActivity.class.getDeclaredMethods();
          let declaresOnDestroy = false;
          for (let i = 0; i < methods.length && i < 96; i++) {
            if (safeText(methods[i].getName(), 64) === 'onDestroy')
              declaresOnDestroy = true;
          }
          if (declaresOnDestroy)
            hook(MainActivity, 'onDestroy', 'MainActivity.onDestroy', isGame);
        } catch (_) { /* optional; base Activity hook still observes super */ }
        // AppTask has no guaranteed Activity package getter, but runs in the
        // game's own injected process. Observe without changing task removal.
        try {
          const AppTask = Java.use('android.app.ActivityManager$AppTask');
          hook(AppTask, 'finishAndRemoveTask', 'AppTask.finishAndRemoveTask', null);
        } catch (_) { note('AppTask hook unavailable'); }
        status = installed > 0 ? 'ARMED' : 'NO_HOOKS';
        note('WZM native exit observer ' + status + ' hooks=' + installed +
             ' frames<=' + limit + ' events<=' + budget +
             ' [diagnostics only, no exit bypass]');
      });
    } catch (_) {
      queued = false;
      status = 'JAVA_PERFORM_FAILED';
    }
    return statusSnapshot();
  }

  return {arm, snapshot: statusSnapshot};
}
