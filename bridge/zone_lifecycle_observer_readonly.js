'use strict';
/*
 * WZM Android 4.5.2 — PASSIVE zone lifecycle observer, not a loader patch.
 * Live-tested on the owner-authorized phone on 2026-11-02.
 * Source of native addresses/offsets: Nov 2 live report, verified separately.
 * Does not call native functions, patch code, write node state or request maps.
 * Host caller should capture output for an already-started ordinary session.
 */
const game = Process.getModuleByName('libgame.so');
const base = game.base;
const addr = x => base.add(x);
const FIRST_NODE_SLOT = 0xc0e4d78;
const MAX_NODES = 24;
const MAX_NAME = 63;
const INTERVAL_MS = 500;
let last = '';
let sampleCount = 0;
let changedCount = 0;
let stop = false;

function tryReadString(address) {
  try {
    // Frida's length-taking readCString can decode embedded NUL padding
    // as replacement characters. Bound the read, then stop at the first NUL.
    const bytes = new Uint8Array(address.readByteArray(MAX_NAME + 1));
    const end = bytes.indexOf(0);
    return String.fromCharCode(...bytes.subarray(0, end < 0 ? MAX_NAME : end));
  } catch (_) { return null; }
}

function snapshot() {
  let node;
  try { node = addr(FIRST_NODE_SLOT).readPointer(); }
  catch (e) { return {error: 'head unreadable', detail: String(e)}; }
  const nodes = [];
  const seen = new Set();
  let bounded = true;
  for (let i = 0; i < MAX_NODES && !node.isNull(); i++) {
    const id = node.toString();
    if (seen.has(id)) { bounded = false; break; }
    seen.add(id);
    try {
      nodes.push({
        node: id,
        // Status/secondary values must arise naturally; never overwrite.
        state20: node.add(0x20).readU8(),
        state21: node.add(0x21).readU8(),
        unloadMark28: node.add(0x28).readU8(),
        currentA: tryReadString(node.add(0x2a)),
        currentB: tryReadString(node.add(0x6a)),
        currentC: tryReadString(node.add(0xaa)),
        requestedA: tryReadString(node.add(0xea)),
        requestedB: tryReadString(node.add(0x12a)),
        requestedC: tryReadString(node.add(0x16a)),
      });
      node = node.add(0x10).readPointer();
    } catch (e) {
      return {error: 'node unreadable', node: id, count: nodes.length,
              detail: String(e), nodes};
    }
  }
  if (!node.isNull()) bounded = false;
  let levelState = null, currentMode = null, requestedMode = null;
  try { levelState = addr(0xc11a688).readS32(); } catch (_) {}
  try { currentMode = addr(0xc115ea8).readU8(); } catch (_) {}
  try { requestedMode = addr(0xc115eb0).readU8(); } catch (_) {}
  return {levelState, currentMode, requestedMode, nodes, bounded};
}

function emitSnapshot(force) {
  if (stop) return;
  ++sampleCount;
  const value = snapshot();
  const encoded = JSON.stringify(value);
  if (force || encoded !== last) {
    ++changedCount;
    last = encoded;
    send({kind: 'zone_snapshot', tick: sampleCount, changed: changedCount,
          nativeWrites: false, data: value});
  }
}

setInterval(() => emitSnapshot(false), INTERVAL_MS);
emitSnapshot(true);
rpc.exports = {
  snapshot() { return snapshot(); },
  stats() { return {sampleCount, changedCount, source: 'read-only'}; },
  stop() { stop = true; return true; },
};
