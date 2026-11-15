/*
 * Runs one original Mac/root Frida script inside this single Gadget script as
 * if frida-server had loaded it as its own script:
 *   - its own globalThis (reads fall through to the real global),
 *   - its own send()/rpc.exports,
 *   - its own Process.setExceptionHandler slot,
 *   - unload() detaches its Interceptor listeners, reverts its replacements
 *     and clears its timers, like Script.unload() on the Mac.
 */

import {attachAnywhere, replaceAnywhere, relayFor, patchTargetFor} from './nearhook.js';

const exceptionHandlers = new Set();
const pinned = new Set();  // live stage scopes (see runStage)
let exceptionDispatcherArmed = false;

function armExceptionDispatcher() {
  if (exceptionDispatcherArmed) return;
  exceptionDispatcherArmed = true;
  Process.setExceptionHandler(details => {
    let handled = false;
    for (const handler of exceptionHandlers) {
      try { if (handler(details) === true) handled = true; } catch (_) {}
    }
    return handled;
  });
}

export function addExceptionObserver(handler) {
  armExceptionDispatcher();
  exceptionHandlers.add(handler);
  return () => exceptionHandlers.delete(handler);
}

// Proxy over an empty object (not the real one): Frida's Process/Interceptor
// carry non-configurable properties, and a Proxy must report those unchanged.
function forward(target, overrides) {
  return new Proxy({}, {
    get(_t, key) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
      const v = target[key];
      return typeof v === 'function' ? v.bind(target) : v;
    },
    has(_t, key) { return key in overrides || key in target; }
  });
}

export function runStage(name, source, {onMessage = () => {}, globals = {}} = {}) {
  const listeners = [];
  const replaced = [];
  const timers = new Set();
  const intervals = new Set();
  let unloaded = false;
  let stageHandler = null;

  const stageGlobal = Object.create(globalThis);
  Object.assign(stageGlobal, globals);

  function send(payload, data) {
    if (unloaded) return;
    try { onMessage(payload, data); } catch (_) {}
  }
  const rpc = {exports: {}};
  const StageInterceptor = {};
  StageInterceptor.attach = (target, callbacks, data) => {
    let listener;
    try {
      listener = attachAnywhere(target, callbacks, data);
    } catch (e) {
      let where = String(target);
      try { const m = Process.findModuleByAddress(ptr(target)); if (m) where = m.name + '+0x' + ptr(target).sub(m.base).toString(16); } catch (_) {}
      try { onMessage({s: 'hookFailed', stage: name, site: where, error: String(e)}); } catch (_) {}
      throw e;
    }
    listeners.push(listener);
    return listener;
  };
  StageInterceptor.replace = (target, replacement, data) => {
    const r = replaceAnywhere(target, replacement, data, false);
    replaced.push(r.at);
    return r.result;
  };
  StageInterceptor.replaceFast = (target, replacement) => {
    const r = replaceAnywhere(target, replacement, undefined, true);
    replaced.push(r.at);
    return r.result;
  };
  StageInterceptor.revert = target => { const r = relayFor(target); Interceptor.revert(r || target); };
  StageInterceptor.flush = () => Interceptor.flush();
  StageInterceptor.detachAll = () => {
    for (const l of listeners.splice(0)) { try { l.detach(); } catch (_) {} }
  };
  const InterceptorProxy = forward(Interceptor, StageInterceptor);

  // Code patches are recorded with their original bytes so unload() can put the
  // game's code back exactly (a fresh copy of the script can then patch again).
  const patches = [];
  const StageMemory = forward(Memory, {
    patchCode(address, size, apply) {
      const addr = patchTargetFor(address, size);
      patches.push({addr, size, bytes: addr.readByteArray(size)});
      return Memory.patchCode(addr, size, apply);
    }
  });

  const StageProcess = forward(Process, {
    setExceptionHandler(handler) {
      armExceptionDispatcher();
      if (stageHandler !== null) exceptionHandlers.delete(stageHandler);
      stageHandler = handler;
      exceptionHandlers.add(handler);
    }
  });

  const stageSetTimeout = (fn, ms, ...args) => {
    const h = setTimeout(() => { timers.delete(h); if (!unloaded) fn(...args); }, ms);
    timers.add(h);
    return h;
  };
  const stageClearTimeout = h => { timers.delete(h); clearTimeout(h); };
  const stageSetInterval = (fn, ms, ...args) => {
    const h = setInterval(() => { if (!unloaded) fn(...args); }, ms);
    intervals.add(h);
    return h;
  };
  const stageClearInterval = h => { intervals.delete(h); clearInterval(h); };
  const stageSetImmediate = (fn, ...args) => setImmediate(() => { if (!unloaded) fn(...args); });

  const names = ['globalThis', 'send', 'recv', 'rpc', 'Interceptor', 'Process', 'Memory',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate'];
  const values = [stageGlobal, send, () => ({wait() {}}), rpc, InterceptorProxy, StageProcess, StageMemory,
    stageSetTimeout, stageClearTimeout, stageSetInterval, stageClearInterval, stageSetImmediate];
  // A Frida script's top-level bindings live as long as the script. Here they
  // are function locals, so pin the whole scope: a closure containing a direct
  // eval captures every binding (CModule, NativeCallback, buffers) until unload.
  // Without this the GC frees native code that installed hooks still call.
  const body = source + '\n;return function __wzmScope(__wzmExpr) { return eval(__wzmExpr); };\n' +
    '//# sourceURL=/wzm/' + name + '.js';
  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, body);
  let scope = fn.apply(stageGlobal, values);
  pinned.add(scope);

  return {
    name,
    global: stageGlobal,
    get exports() { return rpc.exports; },
    evaluate(expr) { return scope ? scope(expr) : undefined; },
    // keepScope: leave the script's native code/thunks allocated (another thread
    // may still be returning through them); only hooks, patches and timers go.
    unload({keepScope = false} = {}) {
      if (unloaded) return;
      unloaded = true;
      for (const h of timers) clearTimeout(h);
      for (const h of intervals) clearInterval(h);
      timers.clear(); intervals.clear();
      for (const l of listeners.splice(0)) { try { l.detach(); } catch (_) {} }
      for (const t of replaced.splice(0)) { try { Interceptor.revert(t); } catch (_) {} }
      try { Interceptor.flush(); } catch (_) {}
      for (const p of patches.splice(0).reverse()) {
        try { Memory.patchCode(p.addr, p.size, code => code.writeByteArray(p.bytes)); } catch (_) {}
      }
      if (stageHandler !== null) { exceptionHandlers.delete(stageHandler); stageHandler = null; }
      if (!keepScope) { pinned.delete(scope); scope = null; }
    }
  };
}
