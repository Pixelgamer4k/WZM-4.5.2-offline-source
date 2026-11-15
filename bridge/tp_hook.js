// Third-person getter hook: resolve the cg.player.isInThirdPersonMode registry node live,
// hook the function at node+0x18 and log/override its boolean return. Read-only until FORCE=1.
const NAME = 'cg.player.isInThirdPersonMode';
const FORCE = %FORCE%;
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
  if (!site) { send({ error: 'no registry ref' }); } else {
    const getterVa = site.add(0x18).readPointer();
    const dataVa = site.add(0x20).readPointer();
    const id = site.add(8).readPointer().readU32();
    let hooked = false, calls = 0, lastRet = null;
    try {
      Interceptor.attach(getterVa, {
        onLeave(ret) {
          calls++;
          try { lastRet = ret.toInt32(); } catch (e) {}
          if (FORCE) { ret.replace(ptr(1)); }
        }
      });
      hooked = true;
    } catch (e) { send({ hookError: String(e) }); }
    send({
      nameAddr: nameAddr.toString(), node: site.toString(),
      getterVa: getterVa.toString(), getterOff: getterVa.sub(mod.base).toString(),
      dataVa: dataVa.toString(), dataOff: dataVa.sub(mod.base).toString(),
      id: id, hooked: hooked, force: FORCE
    });
    // keep the script alive and report every 3 s
    setInterval(() => { send({ stats: { calls: calls, lastRet: lastRet, forced: FORCE } }); }, 3000);
  }
}
