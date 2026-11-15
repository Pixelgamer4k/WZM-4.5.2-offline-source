// Find native xrefs to the payload/getter functions of the cg.player.* registry nodes,
// so we can identify the state getter and hook it.
const mod = Process.getModuleByName('libgame.so');
const SITE = ptr('0x723be305a0');
const targets = [];
function off(p){ try { return (p.compare(mod.base) >= 0 && p.compare(mod.base.add(mod.size)) < 0) ? p.sub(mod.base) : null; } catch(e){ return null; } }
for (let k = -6; k <= 6; k++) {
  const e = SITE.add(k * 0x28);
  let name = null, p18 = ptr(0), p20 = ptr(0);
  try { name = e.readPointer().readUtf8String(64); } catch (x) {}
  try { p18 = e.add(0x18).readPointer(); } catch (x) {}
  try { p20 = e.add(0x20).readPointer(); } catch (x) {}
  const o18 = off(p18);
  if (o18 !== null) targets.push({ k: k, name: name, field: '+18', va: o18.toString() });
}
// report the code pages these VAs live in, and read a few instructions
const out = targets.map(t => {
  let ins = [];
  try {
    const a = mod.base.add(t.va);
    for (let i = 0; i < 6; i++) ins.push(a.add(i * 4).readU32().toString(16));
  } catch (e) {}
  return t.k + ' ' + (t.name || '?') + ' +18=+' + Number(t.va).toString(16) + ' ins=' + ins.join(',');
});
send(out);
