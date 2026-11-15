// Read the state slots for the cg.player.* scriptable-state entries.
// Entry layout found from tp_entry.js: 0x28 stride, +0x00 name ptr, +0x08 slot ptr, +0x20 0x101-ish.
const mod = Process.getModuleByName('libgame.so');
const SITE = ptr('0x723ac9f5a0');
const rows = [];
for (let k = -6; k <= 6; k++) {
  const e = SITE.add(k * 0x28);
  let name = '?', slot = ptr(0), v = null, raw20 = null;
  try { name = e.readPointer().readUtf8String(48) || '?'; } catch (x) {}
  try { slot = e.add(8).readPointer(); } catch (x) {}
  try { v = slot.readU32(); } catch (x) {}
  try { raw20 = e.add(0x20).readPointer().toString(); } catch (x) {}
  rows.push({ k: k, name: name, slot: slot.toString(), slotOff: slot.sub(mod.base).toString(), value: v, f20: raw20 });
}
send(rows);
