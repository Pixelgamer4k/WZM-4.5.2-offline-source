// Dump N entries from the cg.player.* registry starting at the known site, aligned on 0x28,
// and report name / slot-ptr / first u32 / two tag fields. Read-only.
const SITE = ptr('0x723be305a0');
const rows = [];
for (let k = -40; k <= 40; k++) {
  const e = SITE.add(k * 0x28);
  let nm = null, slot = ptr(0), id = null, f18 = null, f20 = null;
  try { nm = e.readPointer().readUtf8String(56); } catch (x) {}
  if (!nm || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(nm)) continue;
  try { slot = e.add(8).readPointer(); } catch (x) {}
  try { id = slot.readU32(); } catch (x) {}
  try { f18 = e.add(0x18).readPointer().toString(); } catch (x) {}
  try { f20 = e.add(0x20).readPointer().toString(); } catch (x) {}
  rows.push(k + ' | ' + nm + ' | id=' + id + ' | f18=' + f18 + ' | f20=' + f20);
}
send({ n: rows.length, rows: rows.slice(0, 50) });
