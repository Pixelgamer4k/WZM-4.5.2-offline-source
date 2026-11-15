// Read every cg.player.* state entry: name -> id, to learn the id range and ordering.
const mod = Process.getModuleByName('libgame.so');
const SITE = ptr('0x723ac9f5a0');
const rows = [];
for (let k = -60; k <= 60; k++) {
  const e = SITE.add(k * 0x28);
  let nm = null, slot = null, id = null;
  try { nm = e.readPointer().readUtf8String(56); } catch (x) {}
  if (!nm || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(nm)) continue;
  try { slot = e.add(8).readPointer(); } catch (x) {}
  try { id = slot.readU32(); } catch (x) {}
  rows.push(nm + '  id=' + id + '  slot=' + (slot ? slot.sub(mod.base).toString() : '?'));
}
send({ n: rows.length, rows: rows });
