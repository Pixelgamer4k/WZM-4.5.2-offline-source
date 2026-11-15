// Classify the registry chain: for each entry, resolve the +0x00 name pointer,
// the +0x08 slot pointer (u32 id), and the +0x18 / +0x20 targets.
const mod = Process.getModuleByName('libgame.so');
const SITE = ptr('0x723be305a0');
function off(p){ try { return (p.compare(mod.base) >= 0 && p.compare(mod.base.add(mod.size)) < 0) ? 'M+0x' + p.sub(mod.base).toString(16) : 'HEAP ' + p.toString(); } catch(e){ return '?'; } }
function s(p){ try { const x = p.readUtf8String(72); return (x && /^[\x20-\x7e]{2,}$/.test(x)) ? x : null; } catch(e){ return null; } }
const rows = [];
for (let k = -4; k <= 6; k++) {
  const e = SITE.add(k * 0x28);
  let p0 = ptr(0), p8 = ptr(0), p18 = ptr(0), p20 = ptr(0);
  try { p0 = e.readPointer(); } catch(x){}
  try { p8 = e.add(8).readPointer(); } catch(x){}
  try { p18 = e.add(0x18).readPointer(); } catch(x){}
  try { p20 = e.add(0x20).readPointer(); } catch(x){}
  let id = null, v18 = null, v20 = null, s0 = s(p0);
  try { id = p8.readU32(); } catch(x){}
  try { v18 = p18.readU32(); } catch(x){}
  try { v20 = p20.readU32(); } catch(x){}
  rows.push('k=' + k + ' name=' + (s0 || '(none)') + ' nameOff=' + off(p0) + ' slot=' + off(p8) + ' id=' + id + ' | +18=' + off(p18) + ' u32=' + v18 + ' | +20=' + off(p20) + ' u32=' + v20);
}
send(rows);
