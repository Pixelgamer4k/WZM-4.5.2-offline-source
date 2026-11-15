// Read the runtime scriptable-state table entry that names cg.player.isInThirdPersonMode,
// and classify every pointer in the surrounding entries (module + offset vs heap).
const mod = Process.getModuleByName('libgame.so');
const SITE = ptr('0x723ac9f5a0');   // pointer site found by tp_probe.js

function classify(p) {
  if (p.isNull()) return 'null';
  try {
    for (const m of Process.enumerateModules()) {
      if (p.compare(m.base) >= 0 && p.compare(m.base.add(m.size)) < 0)
        return m.name + '+0x' + p.sub(m.base).toString(16);
    }
  } catch (e) {}
  try {
    for (const r of Process.enumerateRanges('rw-')) {
      if (p.compare(r.base) >= 0 && p.compare(r.base.add(r.size)) < 0)
        return 'heap[' + r.base.toString() + '+0x' + p.sub(r.base).toString(16) + ']';
    }
  } catch (e) {}
  return 'other:' + p.toString();
}

function str(p) { try { const s = p.readUtf8String(64); return (s && /^[\x20-\x7e]+$/.test(s)) ? s : null; } catch (e) { return null; } }

const rows = [];
// walk 5 entries at 0x30 stride both directions from the hit
for (let k = -3; k <= 3; k++) {
  const base = SITE.add(k * 0x30);
  const row = [];
  for (let off = 0; off < 0x30; off += 8) {
    let v = ptr(0), s = null;
    try { v = base.add(off).readPointer(); } catch (e) {}
    s = str(v);
    row.push(off.toString(16) + '=' + v.toString() + (s ? ' "' + s.slice(0, 40) + '"' : '') + ' [' + classify(v) + ']');
  }
  rows.push('entry ' + k + ': ' + row.join(' | '));
}
send({ module: mod.base.toString() + '-' + mod.base.add(mod.size).toString(), rows: rows });
