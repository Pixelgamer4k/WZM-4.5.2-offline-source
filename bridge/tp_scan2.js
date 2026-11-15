// Walk the registry without assuming stride: follow the +0x00 name pointers from the known site
// and report every entry whose name pointer resolves to a printable dotted string.
const mod = Process.getModuleByName('libgame.so');
const SITE = ptr('0x723be305a0');
function nm(p){ try { const s = p.readUtf8String(72); return (s && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(s)) ? s : null; } catch(e){ return null; } }
const out = [];
// scan a window of the table region for name pointers
const lo = SITE.sub(0x2000), hi = SITE.add(0x2000);
for (let a = lo; a.compare(hi) < 0; a = a.add(8)) {
  let p = ptr(0);
  try { p = a.readPointer(); } catch (e) { continue; }
  const s = nm(p);
  if (!s) continue;
  let slot = ptr(0), id = null, f20 = null;
  try { slot = a.add(8).readPointer(); id = slot.readU32(); } catch (e) {}
  try { f20 = a.add(0x20).readPointer().toString(); } catch (e) {}
  out.push({ at: a.sub(mod.base).toString(), name: s, slot: slot.sub(mod.base).toString(), id: id, f20: f20 });
  if (out.length > 60) break;
}
send({ n: out.length, rows: out.slice(0, 40) });
