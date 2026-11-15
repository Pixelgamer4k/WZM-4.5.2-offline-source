// Scan readable memory for 1 KB pages of 21-bit packed positions that are spatially tight (meshlet-like).
const cm = new CModule(`
unsigned int scan(const unsigned char *p, unsigned long n, unsigned int *out, unsigned int maxout) {
  unsigned int c = 0;
  for (unsigned long off = 0; off + 1024 <= n; off += 1024) {
    const unsigned int *w = (const unsigned int *)(p + off);
    unsigned int mnx = 0xffffffff, mny = 0xffffffff, mnz = 0xffffffff, mxx = 0, mxy = 0, mxz = 0, zero = 0, same = 0;
    for (int i = 0; i < 128; i++) {
      unsigned int lo = w[2 * i], hi = w[2 * i + 1];
      if (!lo && !hi) { zero++; continue; }
      if (i && lo == w[2 * i - 2] && hi == w[2 * i - 1]) same++;
      unsigned int x = lo & 0x1FFFFF, y = (lo >> 21) | ((hi & 1023) << 11), z = (hi >> 10) & 0x1FFFFF;
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (y < mny) mny = y; if (y > mxy) mxy = y;
      if (z < mnz) mnz = z; if (z > mxz) mxz = z;
    }
    if (zero > 32 || same > 32 || mxx < mnx) continue;
    unsigned int dx = mxx - mnx, dy = mxy - mny, dz = mxz - mnz;
    unsigned int e = dx > dy ? dx : dy; e = e > dz ? e : dz;
    if (e > 256 && e < 131072 && (dx > 64) + (dy > 64) + (dz > 64) >= 2) { if (c < maxout) out[c] = (unsigned int)(off >> 10); c++; }
  }
  return c;
}`);
const scan = new NativeFunction(cm.scan, 'uint', ['pointer', 'ulong', 'pointer', 'uint']);
const out = Memory.alloc(4 * 65536);
const res = [];
for (const r of Process.enumerateRanges('r--')) {
  if (r.size < 1 << 20) continue;
  const path = r.file ? r.file.path : '';
  if (/\.so$|\.apk$|\.oat$|\.art$|\.vdex$|dalvik|\.ttf/.test(path)) continue;
  let c = 0;
  try { c = scan(r.base, r.size, out, 65536); } catch (e) { continue; }
  if (c > 32) res.push({ base: r.base.toString(), size: r.size, prot: r.protection, path, tight: c, frac: +(c / (r.size / 1024)).toFixed(4), first: Array.from(new Uint32Array(out.readByteArray(4 * Math.min(c, 8)))) });
}
res.sort((a, b) => b.tight - a.tight);
send({ s: 'poolScan', n: res.length, top: res.slice(0, 25) });
rpc.exports = { read(base, size) { return ptr(base).readByteArray(size); } };
