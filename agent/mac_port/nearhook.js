/*
 * Hooks that work on every phone.
 *
 * Frida hooks a short function / mid-function instruction with a 4-byte branch
 * to a trampoline that must lie within ±128 MB. libgame.so is 222 MB and on
 * some phones (Redmi Note 10 Pro, Android 13) every byte within reach is
 * already mapped, so Interceptor.attach fails ("unable to intercept function").
 *
 * Fallback: a relay in libgame's own unused padding (always within reach):
 *     site:  B relay                      (one atomic 4-byte write)
 *     relay: NOP NOP NOP NOP              (Frida hooks here: 16 plain bytes)
 *            <original first instruction, relocated>
 *            B site+4
 * Execution reaches the relay with exactly the registers and LR it had at the
 * site, so onEnter/onLeave/replace behave as if the site itself were hooked.
 */
import {CAVES, FRAGILE} from './caves.js';

let fragileSet = null;
function isFragile(t) {
  if (fragileSet === null) {
    const base = Process.getModuleByName('libgame.so').base;
    fragileSet = new Set(FRAGILE.map(o => base.add(o).toString()));
  }
  return fragileSet.has(t.toString());
}

// DISABLED 11 Nov 2026 (owner: revert). r14 relays crashed the OnePlus match load with an
// illegal instruction at libgame+0x3cd64d4 (inside a relay in cave 0x3cd6488). Until that is
// understood, every helper below behaves exactly like plain Interceptor (r13 behaviour).
export const RELAYS_ENABLED = false;

const relays = new Map();    // site address string -> relay pointer
let caveCursor = null;       // [{addr, end}] runtime-validated caves
const RELAY_BYTES = 48;
const RANGE = 120 * 1024 * 1024;
function distance(a, b) {   // |a - b| without unsigned wrap-around
  return a.compare(b) >= 0 ? Number(a.sub(b).toString()) : Number(b.sub(a).toString());
}

function cavesReady() {
  if (caveCursor !== null) return caveCursor;
  caveCursor = [];
  const base = Process.getModuleByName('libgame.so').base;
  for (const [off, size] of CAVES) {
    const a = base.add(off);
    try {
      const bytes = new Uint8Array(a.readByteArray(size));
      if (bytes.every(b => b === 0)) caveCursor.push({addr: a, end: a.add(size)});
    } catch (_) {}
  }
  return caveCursor;
}

function takeRelay(site) {
  let best = null, bestDist = Infinity;
  for (const c of cavesReady()) {
    if (c.end.sub(c.addr).compare(ptr(RELAY_BYTES)) < 0) continue;
    const d = distance(c.addr, site);
    if (d < RANGE && d < bestDist) { best = c; bestDist = d; }
  }
  if (best === null) return null;
  const r = best.addr;
  best.addr = best.addr.add(RELAY_BYTES);
  return r;
}

function buildRelay(site) {
  const key = site.toString();
  if (relays.has(key)) return relays.get(key);
  const relay = takeRelay(site);
  if (relay === null) throw new Error('no code cave within reach of ' + site);
  Memory.patchCode(relay, RELAY_BYTES, code => {
    const w = new Arm64Writer(code, {pc: relay});
    for (let i = 0; i < 4; i++) w.putNop();
    const r = new Arm64Relocator(site, w);
    if (r.readOne() === 0) throw new Error('cannot relocate first instruction at ' + site);
    r.writeOne();
    if (!r.eob) w.putBImm(site.add(4));
    w.flush();
    r.dispose();
    w.dispose();
  });
  Memory.patchCode(site, 4, code => {
    const w = new Arm64Writer(code, {pc: site});
    w.putBImm(relay);
    w.flush();
    w.dispose();
  });
  relays.set(key, relay);
  return relay;
}

// Space check without touching code (used by the start-up probe).
export function relayPossible(target) {
  const t = ptr(target);
  if (relayFor(t) !== null) return true;
  for (const c of cavesReady()) {
    if (c.end.sub(c.addr).compare(ptr(RELAY_BYTES)) < 0) continue;
    if (distance(c.addr, t) < RANGE) return true;
  }
  return false;
}
export function fragile(target) { return isFragile(ptr(target)); }
// A relay holds the site's first instruction at relay+16. A later 4-byte code
// patch of the site must land there, or it would overwrite the branch to the relay.
export function patchTargetFor(address, size) {
  const r = relayFor(address);
  return r !== null && size === 4 ? r.add(16) : ptr(address);
}

export function relayFor(target) {
  return relays.get(ptr(target).toString()) || null;
}

// Interceptor.attach that never fails for lack of nearby memory.
export function attachAnywhere(target, callbacks, data) {
  const t = ptr(target);
  const existing = RELAYS_ENABLED ? (relayFor(t) || (isFragile(t) ? buildRelay(t) : null)) : null;
  if (existing !== null) return data === undefined ? Interceptor.attach(existing, callbacks)
    : Interceptor.attach(existing, callbacks, data);
  try {
    return data === undefined ? Interceptor.attach(t, callbacks) : Interceptor.attach(t, callbacks, data);
  } catch (e) {
    if (!RELAYS_ENABLED || !/unable to intercept/i.test(String(e))) throw e;
    const relay = buildRelay(t);
    return data === undefined ? Interceptor.attach(relay, callbacks) : Interceptor.attach(relay, callbacks, data);
  }
}

export function replaceAnywhere(target, replacement, data, fast = false) {
  const t = ptr(target);
  const call = at => fast ? Interceptor.replaceFast(at, replacement)
    : (data === undefined ? Interceptor.replace(at, replacement) : Interceptor.replace(at, replacement, data));
  const existing = RELAYS_ENABLED ? (relayFor(t) || (isFragile(t) ? buildRelay(t) : null)) : null;
  if (existing !== null) return {at: existing, result: call(existing)};
  try {
    return {at: t, result: call(t)};
  } catch (e) {
    if (!RELAYS_ENABLED || !/unable to intercept/i.test(String(e))) throw e;
    const relay = buildRelay(t);
    return {at: relay, result: call(relay)};
  }
}
