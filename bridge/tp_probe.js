// Third-person state probe (read-only).
// 1. locate the ASCII name in libgame's readable ranges at runtime
// 2. find pointers to it in writable memory (the scriptable-state registry built at runtime)
// 3. dump pointer-site context so the slot layout can be read off
const NAME = 'cg.player.isInThirdPersonMode';
const pat = (NAME + '\0').split('').map(c => ('0' + c.charCodeAt(0).toString(16)).slice(-2)).join(' ');

function findName() {
  const out = [];
  let ranges = [];
  try { ranges = Module.enumerateRangesSync('libgame.so', 'r--'); } catch (e) { ranges = Process.enumerateRanges('r--'); }
  for (const r of ranges) {
    try {
      const hits = Memory.scanSync(r.base, r.size, pat);
      for (const h of hits) out.push(h.address);
    } catch (e) {}
    if (out.length > 4) break;
  }
  return out;
}

function hexBytes(addr) {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(addr.toString()), true);
  return Array.from(new Uint8Array(buf)).map(b => ('0' + b.toString(16)).slice(-2)).join(' ');
}

function findRefs(targets) {
  const out = [];
  for (const r of Process.enumerateRanges('rw-')) {
    for (const t of targets) {
      let scanFrom = r.base;
      const end = r.base.add(r.size);
      while (scanFrom.compare(end) < 0) {
        const len = Math.min(2 * 1024 * 1024, end.sub(scanFrom).toInt32());
        if (len <= 0) break;
        let hits = [];
        try { hits = Memory.scanSync(scanFrom, len, hexBytes(t)); } catch (e) {}
        for (const h of hits) {
          const ctx = [];
          for (let off = -0x30; off <= 0x50; off += 8) {
            let v = '?';
            try { v = h.address.add(off).readPointer().toString(); } catch (e) {}
            ctx.push(off.toString() + ':' + v);
          }
          out.push({ at: h.address.toString(), ctx: ctx.join(' ') });
          if (out.length > 16) return out;
        }
        scanFrom = scanFrom.add(len);
      }
    }
  }
  return out;
}

const names = findName();
const refs = names.length ? findRefs(names) : [];
send({ name_addrs: names.map(String), n_refs: refs.length, refs: refs.slice(0, 8) });
