// Dump raw memory around the registry site so the layout can be read directly.
const SITE = ptr('0x723be305a0');
const dump = [];
for (let off = -0x80; off <= 0x80; off += 8) {
  let v = '?';
  try { v = SITE.add(off).readPointer().toString(); } catch (e) {}
  dump.push(off.toString().padStart(4) + ' : ' + v);
}
// and try to read a string at several of those pointers
const strs = [];
for (let off = -0x80; off <= 0x80; off += 8) {
  try {
    const p = SITE.add(off).readPointer();
    const s = p.readUtf8String(64);
    if (s && /^[\x20-\x7e]{3,}$/.test(s)) strs.push(off + ' -> "' + s.slice(0, 48) + '"');
  } catch (e) {}
}
send({ dump: dump, strs: strs });
