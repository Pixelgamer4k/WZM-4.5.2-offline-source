// Re-resolve the cg.player.isInThirdPersonMode registry entry live (addresses move between scripts).
const NAME = 'cg.player.isInThirdPersonMode';
const pat = (NAME + '\0').split('').map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join(' ');
const mod = Process.getModuleByName('libgame.so');
let nameAddr = null;
for (const r of Process.enumerateRanges('r--')) {
  try { const h = Memory.scanSync(r.base, r.size, pat); if (h.length) { nameAddr = h[0].address; break; } } catch (e) {}
}
if (!nameAddr) { send({ error: 'name not found' }); } else {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(nameAddr.toString()), true);
  const pb = Array.from(new Uint8Array(buf)).map(b => ('0' + b.toString(16)).slice(-2)).join(' ');
  let site = null;
  for (const r of Process.enumerateRanges('rw-')) {
    try { const h = Memory.scanSync(r.base, r.size, pb); if (h.length) { site = h[0].address; break; } } catch (e) {}
  }
  if (!site) { send({ error: 'no ref', nameAddr: nameAddr.toString() }); } else {
    // entry base = site - (site % 0x28) relative to table start; align on the hit and read
    const e = site;
    const slot = e.add(8).readPointer();
    send({
      nameAddr: nameAddr.toString(), site: site.toString(),
      siteOff: site.sub(mod.base).toString(),
      slot: slot.toString(), slotOff: slot.sub(mod.base).toString(),
      id: slot.readU32(),
      f18: e.add(0x18).readPointer().toString(),
      f18Off: e.add(0x18).readPointer().sub(mod.base).toString(),
      f20: e.add(0x20).readPointer().toString()
    });
  }
}
