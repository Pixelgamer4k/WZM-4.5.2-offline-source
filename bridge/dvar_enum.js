// Dvar enumerator: walks the same table gfx_set.js uses, and additionally reads the
// dvar NAME if the entry carries a pointer to it. rpc: dump(n) -> [{h,type,cur,def,lo,hi,flags,name}]
const b = Process.getModuleByName('libgame.so').base;
const d1 = b.add(0x54bd7b8).readPointer().readPointer();
const S = 0x58;
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const idx = {};
for (const dir of [-1, 1]) { let p = dir > 0 ? d1.add(S) : d1; let miss = 0; while (miss < 400) { if (ok(p)) { miss = 0; idx[p.readU64().toString(16)] = p; } else miss++; p = p.add(dir * S); } }
function nameOf(p) {
  // try a few plausible name-pointer slots; return printable string if it looks like a dvar name
  for (const off of [0x8, 0x10, 0x18, 0x20, 0x30, 0x40, 0x50]) {
    try {
      const q = p.add(off).readPointer();
      if (q.isNull() || q.compare(b) < 0) continue;
      const s = q.readUtf8String(64);
      if (s && /^[a-z_][a-z0-9_\/\.]{2,60}$/i.test(s)) return s;
    } catch (e) {}
  }
  return null;
}
function info(p) {
  const t = p.add(0x15).readU8();
  return { type: t, cur: t === 1 ? p.add(0x28).readFloat() : p.add(0x28).readS32(), def: t === 1 ? p.add(0x48).readFloat() : p.add(0x48).readS32(), lo: p.add(0x18).readS32(), hi: p.add(0x1c).readS32(), flags: p.add(0x10).readU32(), name: nameOf(p) };
}
rpc.exports = {
  count() { return Object.keys(idx).length; },
  dump() { const o = []; for (const k in idx) { const i = info(idx[k]); i.h = k; o.push(i); } return o; },
  named() { const o = []; for (const k in idx) { const i = info(idx[k]); if (i.name) { i.h = k; o.push(i); } } return o; }
};
